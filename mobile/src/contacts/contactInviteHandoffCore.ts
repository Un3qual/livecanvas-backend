const CONTACT_INVITE_HANDOFF_KEY = 'lc_pending_contact_invite';
const CONTACT_INVITE_HANDOFF_TTL_MS = 60 * 60 * 1_000;
const storageQueues = new WeakMap<object, Promise<void>>();

type PendingContactInvite = {
  readonly expiresAt: number;
  readonly handoffId: string;
  readonly token: string;
};

export type ContactInviteHandoffStorage = {
  deleteItem: (key: string) => Promise<void>;
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

type ContactInviteHandoffOptions = {
  readonly now?: () => number;
  readonly storage: ContactInviteHandoffStorage;
};

type StoreContactInviteHandoffOptions = ContactInviteHandoffOptions & {
  readonly createHandoffId: () => string;
};

export type ContactInviteHandoffStatus =
  | 'expired'
  | 'matched'
  | 'mismatch'
  | 'missing';

export async function storeContactInviteHandoff(
  token: string,
  options: StoreContactInviteHandoffOptions,
): Promise<{ readonly handoffId: string }> {
  const now = options.now?.() ?? Date.now();
  const handoffId = options.createHandoffId();
  const record: PendingContactInvite = {
    expiresAt: now + CONTACT_INVITE_HANDOFF_TTL_MS,
    handoffId,
    token,
  };

  await withStorageLock(options.storage, () =>
    options.storage.setItem(
      CONTACT_INVITE_HANDOFF_KEY,
      JSON.stringify(record),
    ),
  );

  return { handoffId };
}

export function readContactInviteHandoffStatus(
  requestedHandoffId: string,
  options: ContactInviteHandoffOptions,
): Promise<ContactInviteHandoffStatus> {
  return withStorageLock(options.storage, async () => {
    const record = await readRecord(options.storage);

    if (!record) {
      return 'missing';
    }

    if (record.expiresAt <= (options.now?.() ?? Date.now())) {
      await options.storage.deleteItem(CONTACT_INVITE_HANDOFF_KEY);
      return 'expired';
    }

    return record.handoffId === requestedHandoffId ? 'matched' : 'mismatch';
  });
}

export async function withContactInviteToken<Value>(
  requestedHandoffId: string,
  callback: (token: string) => Promise<Value>,
  options: ContactInviteHandoffOptions,
): Promise<
  | { readonly status: Exclude<ContactInviteHandoffStatus, 'matched'> }
  | { readonly status: 'matched'; readonly value: Value }
> {
  const lookup = await withStorageLock(options.storage, async () => {
    const record = await readRecord(options.storage);

    if (!record) {
      return { status: 'missing' as const };
    }

    if (record.expiresAt <= (options.now?.() ?? Date.now())) {
      await options.storage.deleteItem(CONTACT_INVITE_HANDOFF_KEY);
      return { status: 'expired' as const };
    }

    if (record.handoffId !== requestedHandoffId) {
      return { status: 'mismatch' as const };
    }

    return { status: 'matched' as const, token: record.token };
  });

  if (lookup.status !== 'matched') {
    return lookup;
  }

  return { status: 'matched', value: await callback(lookup.token) };
}

export function clearContactInviteHandoff(
  requestedHandoffId: string,
  options: ContactInviteHandoffOptions,
): Promise<boolean> {
  return withStorageLock(options.storage, async () => {
    const record = await readRecord(options.storage);

    if (!record || record.handoffId !== requestedHandoffId) {
      return false;
    }

    await options.storage.deleteItem(CONTACT_INVITE_HANDOFF_KEY);
    return true;
  });
}

async function readRecord(
  storage: ContactInviteHandoffStorage,
): Promise<PendingContactInvite | null> {
  const serialized = await storage.getItem(CONTACT_INVITE_HANDOFF_KEY);

  if (!serialized) {
    return null;
  }

  try {
    const value = JSON.parse(serialized) as Partial<PendingContactInvite>;

    if (
      typeof value.expiresAt !== 'number' ||
      !Number.isFinite(value.expiresAt) ||
      typeof value.handoffId !== 'string' ||
      !value.handoffId ||
      typeof value.token !== 'string' ||
      !value.token
    ) {
      await storage.deleteItem(CONTACT_INVITE_HANDOFF_KEY);
      return null;
    }

    return {
      expiresAt: value.expiresAt,
      handoffId: value.handoffId,
      token: value.token,
    };
  } catch {
    await storage.deleteItem(CONTACT_INVITE_HANDOFF_KEY);
    return null;
  }
}

function withStorageLock<Value>(
  storage: ContactInviteHandoffStorage,
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
