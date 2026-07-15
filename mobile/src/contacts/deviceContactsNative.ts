import {
  DEVICE_CONTACT_IMPORT_CHUNK_SIZE,
  normalizeDeviceContacts,
  type DeviceContactImportEntry,
  type DeviceContactLike,
} from './deviceContactImport';

export type DeviceContactsModule = {
  readonly Fields: {
    readonly Emails: string;
    readonly PhoneNumbers: string;
  };
  readonly SortTypes: {
    readonly FirstName: string;
  };
  readonly requestPermissionsAsync: () => Promise<{ readonly granted: boolean }>;
  readonly getContactsAsync: (options: {
    readonly fields: readonly string[];
    readonly pageOffset: number;
    readonly pageSize: number;
    readonly sort: string;
  }) => Promise<{
    readonly data: readonly DeviceContactLike[];
    readonly hasNextPage: boolean;
  }>;
};

export type DeviceContactsReadResult =
  | { readonly status: 'granted'; readonly entryCount: number }
  | { readonly status: 'denied' | 'unavailable' | 'failed' };

type DeviceContactsReadOptions = {
  readonly loadContactsModule?: () => Promise<DeviceContactsModule | null>;
  readonly onEntries?: (
    entries: readonly DeviceContactImportEntry[],
  ) => Promise<void> | void;
};

export async function readDeviceContacts({
  loadContactsModule = loadExpoContactsModule,
  onEntries = () => undefined,
}: DeviceContactsReadOptions = {}): Promise<DeviceContactsReadResult> {
  let contacts: DeviceContactsModule | null;

  try {
    contacts = await loadContactsModule();
  } catch {
    return { status: 'unavailable' };
  }

  if (!contacts) {
    return { status: 'unavailable' };
  }

  let permission: Awaited<
    ReturnType<DeviceContactsModule['requestPermissionsAsync']>
  >;

  try {
    permission = await contacts.requestPermissionsAsync();
  } catch {
    return { status: 'failed' };
  }

  if (!permission.granted) {
    return { status: 'denied' };
  }

  // Native read failures are mapped by the page reader. Consumer failures must
  // keep bubbling so the import workflow can report an upload failure.
  return readGrantedContactPages(contacts, onEntries);
}

async function readGrantedContactPages(
  contacts: DeviceContactsModule,
  onEntries: (
    entries: readonly DeviceContactImportEntry[],
  ) => Promise<void> | void,
): Promise<DeviceContactsReadResult> {
  let entryCount = 0;
  let pageOffset = 0;

  while (true) {
    let result: Awaited<ReturnType<DeviceContactsModule['getContactsAsync']>>;

    try {
      result = await contacts.getContactsAsync({
        fields: [contacts.Fields.Emails, contacts.Fields.PhoneNumbers],
        pageOffset,
        pageSize: DEVICE_CONTACT_IMPORT_CHUNK_SIZE,
        sort: contacts.SortTypes.FirstName,
      });
    } catch {
      return { status: 'failed' };
    }

    const entries = normalizeDeviceContacts(result.data);

    if (entries.length > 0) {
      // Awaiting the consumer keeps at most one native page and one upload
      // chunk live at a time, even for very large address books.
      await onEntries(entries);
      entryCount += entries.length;
    }

    if (!result.hasNextPage) {
      return { entryCount, status: 'granted' };
    }

    if (result.data.length === 0) {
      return { status: 'failed' };
    }

    pageOffset += result.data.length;
  }
}

async function loadExpoContactsModule(): Promise<DeviceContactsModule> {
  return (await import('expo-contacts')) as unknown as DeviceContactsModule;
}
