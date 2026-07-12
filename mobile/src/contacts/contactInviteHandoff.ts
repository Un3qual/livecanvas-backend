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
  readonly createHandoffId?: () => string;
  readonly now?: () => number;
  readonly storage?: ContactInviteHandoffStorage;
};

export type ContactInviteHandoffStatus =
  | 'expired'
  | 'matched'
  | 'mismatch'
  | 'missing';

const secureStorage: ContactInviteHandoffStorage = {
  deleteItem: async (key) => {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(key);
  },
  getItem: async (key) => {
    const SecureStore = await import('expo-secure-store');
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key, value) => {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  },
};

export async function storeContactInviteHandoff(
  token: string,
  options: ContactInviteHandoffOptions = {},
): Promise<{ readonly handoffId: string }> {
  const now = options.now?.() ?? Date.now();
  const handoffId = options.createHandoffId
    ? options.createHandoffId()
    : (await import('expo-crypto')).randomUUID();
  const record: PendingContactInvite = {
    expiresAt: now + CONTACT_INVITE_HANDOFF_TTL_MS,
    handoffId,
    token,
  };

  const storage = storageFrom(options);
  await withStorageLock(storage, () =>
    storage.setItem(CONTACT_INVITE_HANDOFF_KEY, JSON.stringify(record)),
  );

  return { handoffId };
}

export function readContactInviteHandoffStatus(
  requestedHandoffId: string,
  options: ContactInviteHandoffOptions = {},
): Promise<ContactInviteHandoffStatus> {
  const storage = storageFrom(options);

  return withStorageLock(storage, async () => {
    const record = await readRecord(storage);

    if (!record) {
      return 'missing';
    }

    if (record.expiresAt <= (options.now?.() ?? Date.now())) {
      await storage.deleteItem(CONTACT_INVITE_HANDOFF_KEY);
      return 'expired';
    }

    return record.handoffId === requestedHandoffId ? 'matched' : 'mismatch';
  });
}

export async function withContactInviteToken<Value>(
  requestedHandoffId: string,
  callback: (token: string) => Promise<Value>,
  options: ContactInviteHandoffOptions = {},
): Promise<
  | { readonly status: Exclude<ContactInviteHandoffStatus, 'matched'> }
  | { readonly status: 'matched'; readonly value: Value }
> {
  const storage = storageFrom(options);
  const lookup = await withStorageLock(storage, async () => {
    const record = await readRecord(storage);

    if (!record) {
      return { status: 'missing' as const };
    }

    if (record.expiresAt <= (options.now?.() ?? Date.now())) {
      await storage.deleteItem(CONTACT_INVITE_HANDOFF_KEY);
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
  options: ContactInviteHandoffOptions = {},
): Promise<boolean> {
  const storage = storageFrom(options);

  return withStorageLock(storage, async () => {
    const record = await readRecord(storage);

    if (!record || record.handoffId !== requestedHandoffId) {
      return false;
    }

    await storage.deleteItem(CONTACT_INVITE_HANDOFF_KEY);
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

function storageFrom(
  options: ContactInviteHandoffOptions,
): ContactInviteHandoffStorage {
  return options.storage ?? secureStorage;
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
