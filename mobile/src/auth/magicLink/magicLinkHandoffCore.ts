import type { MagicLinkPayload } from './magicLinkLink';

const MAGIC_LINK_HANDOFF_KEY = 'lc_pending_magic_link';
const MAGIC_LINK_HANDOFF_TTL_MS = 15 * 60 * 1_000;
const storageQueues = new WeakMap<object, Promise<void>>();
const handoffAttempts = new WeakMap<
  MagicLinkHandoffStorage,
  Map<string, Promise<MagicLinkHandoffResult<unknown>>>
>();

type PendingMagicLink = MagicLinkPayload & {
  readonly expiresAt: number;
  readonly handoffId: string;
};

export type MagicLinkHandoffStorage = {
  deleteItem: (key: string) => Promise<void>;
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

type MagicLinkHandoffOptions = {
  readonly now?: () => number;
  readonly storage: MagicLinkHandoffStorage;
};

type StoreMagicLinkHandoffOptions = MagicLinkHandoffOptions & {
  readonly createHandoffId: () => string;
};

type MagicLinkHandoffStatus = 'expired' | 'mismatch' | 'missing';
type MagicLinkHandoffResult<Value> =
  | { readonly status: MagicLinkHandoffStatus }
  | { readonly status: 'matched'; readonly value: Value };

export type MagicLinkHandoffResultPolicy<Value> = {
  readonly shouldRetainResult?: (value: Value) => boolean;
};

type WithMagicLinkHandoffOptions<Value> = MagicLinkHandoffOptions &
  MagicLinkHandoffResultPolicy<Value>;

export async function storeMagicLinkHandoff(
  payload: MagicLinkPayload,
  options: StoreMagicLinkHandoffOptions,
): Promise<{ readonly handoffId: string }> {
  const now = options.now?.() ?? Date.now();
  const handoffId = options.createHandoffId();
  const record: PendingMagicLink = {
    expiresAt: now + MAGIC_LINK_HANDOFF_TTL_MS,
    handoffId,
    purpose: payload.purpose,
    token: payload.token,
  };

  await withStorageLock(options.storage, () =>
    options.storage.setItem(MAGIC_LINK_HANDOFF_KEY, JSON.stringify(record)),
  );
  forgetAllHandoffAttempts(options.storage);

  return { handoffId };
}

export function withMagicLinkHandoff<Value>(
  requestedHandoffId: string,
  callback: (payload: MagicLinkPayload) => Promise<Value>,
  options: WithMagicLinkHandoffOptions<Value>,
): Promise<MagicLinkHandoffResult<Value>> {
  const attempts = getHandoffAttempts(options.storage);
  const existing = attempts.get(requestedHandoffId);

  if (existing) {
    return existing as Promise<MagicLinkHandoffResult<Value>>;
  }

  const attempt = performMagicLinkHandoff(
    requestedHandoffId,
    callback,
    options,
  );
  attempts.set(
    requestedHandoffId,
    attempt as Promise<MagicLinkHandoffResult<unknown>>,
  );

  // A definitive redemption must survive a screen remount until its matching
  // handoff is cleared. Retryable or rejected attempts are released instead.
  void attempt.then(
    (result) => {
      const retain =
        result.status === 'matched' &&
        options.shouldRetainResult?.(result.value) === true;

      if (!retain) {
        forgetHandoffAttempt(options.storage, requestedHandoffId, attempt);
      }
    },
    () => forgetHandoffAttempt(options.storage, requestedHandoffId, attempt),
  );

  return attempt;
}

async function performMagicLinkHandoff<Value>(
  requestedHandoffId: string,
  callback: (payload: MagicLinkPayload) => Promise<Value>,
  options: MagicLinkHandoffOptions,
): Promise<MagicLinkHandoffResult<Value>> {
  const lookup = await withStorageLock(options.storage, async () => {
    const record = await readRecord(options.storage);

    if (!record) {
      return { status: 'missing' as const };
    }

    if (record.expiresAt <= (options.now?.() ?? Date.now())) {
      await options.storage.deleteItem(MAGIC_LINK_HANDOFF_KEY);
      return { status: 'expired' as const };
    }

    if (record.handoffId !== requestedHandoffId) {
      return { status: 'mismatch' as const };
    }

    return {
      status: 'matched' as const,
      payload: { purpose: record.purpose, token: record.token },
    };
  });

  if (lookup.status !== 'matched') {
    return lookup;
  }

  return { status: 'matched', value: await callback(lookup.payload) };
}

export function clearMagicLinkHandoff(
  requestedHandoffId: string,
  options: MagicLinkHandoffOptions,
): Promise<boolean> {
  return withStorageLock(options.storage, async () => {
    const record = await readRecord(options.storage);

    if (!record || record.handoffId !== requestedHandoffId) {
      return false;
    }

    await options.storage.deleteItem(MAGIC_LINK_HANDOFF_KEY);
    return true;
  }).then((cleared) => {
    forgetHandoffAttempt(options.storage, requestedHandoffId);
    return cleared;
  });
}

function getHandoffAttempts(
  storage: MagicLinkHandoffStorage,
): Map<string, Promise<MagicLinkHandoffResult<unknown>>> {
  const existing = handoffAttempts.get(storage);

  if (existing) {
    return existing;
  }

  const attempts = new Map<
    string,
    Promise<MagicLinkHandoffResult<unknown>>
  >();
  handoffAttempts.set(storage, attempts);
  return attempts;
}

function forgetHandoffAttempt(
  storage: MagicLinkHandoffStorage,
  handoffId: string,
  expectedAttempt?: Promise<MagicLinkHandoffResult<unknown>>,
) {
  const attempts = handoffAttempts.get(storage);

  if (!attempts) {
    return;
  }

  if (expectedAttempt && attempts.get(handoffId) !== expectedAttempt) {
    return;
  }

  attempts.delete(handoffId);

  if (attempts.size === 0) {
    handoffAttempts.delete(storage);
  }
}

function forgetAllHandoffAttempts(storage: MagicLinkHandoffStorage) {
  handoffAttempts.delete(storage);
}

async function readRecord(
  storage: MagicLinkHandoffStorage,
): Promise<PendingMagicLink | null> {
  const serialized = await storage.getItem(MAGIC_LINK_HANDOFF_KEY);

  if (!serialized) {
    return null;
  }

  try {
    const value = JSON.parse(serialized) as Partial<PendingMagicLink>;

    if (
      typeof value.expiresAt !== 'number' ||
      !Number.isFinite(value.expiresAt) ||
      typeof value.handoffId !== 'string' ||
      !value.handoffId ||
      (value.purpose !== 'signIn' && value.purpose !== 'signUp') ||
      typeof value.token !== 'string' ||
      !value.token
    ) {
      await storage.deleteItem(MAGIC_LINK_HANDOFF_KEY);
      return null;
    }

    return {
      expiresAt: value.expiresAt,
      handoffId: value.handoffId,
      purpose: value.purpose,
      token: value.token,
    };
  } catch {
    await storage.deleteItem(MAGIC_LINK_HANDOFF_KEY);
    return null;
  }
}

function withStorageLock<Value>(
  storage: MagicLinkHandoffStorage,
  operation: () => Promise<Value>,
): Promise<Value> {
  const previous = storageQueues.get(storage) ?? Promise.resolve();
  const result = previous.catch(() => undefined).then(operation);

  storageQueues.set(
    storage,
    result.then(
      () => undefined,
      () => undefined,
    ),
  );

  return result;
}
