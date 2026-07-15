import type { MagicLinkPayload } from './magicLinkLink';

const MAGIC_LINK_HANDOFF_KEY = 'lc_pending_magic_link';
const MAGIC_LINK_HANDOFF_TTL_MS = 15 * 60 * 1_000;
const storageQueues = new WeakMap<object, Promise<void>>();

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

  return { handoffId };
}

export async function withMagicLinkHandoff<Value>(
  requestedHandoffId: string,
  callback: (payload: MagicLinkPayload) => Promise<Value>,
  options: MagicLinkHandoffOptions,
): Promise<
  | { readonly status: MagicLinkHandoffStatus }
  | { readonly status: 'matched'; readonly value: Value }
> {
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
  });
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
