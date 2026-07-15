import {
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
    readonly sort: string;
  }) => Promise<{ readonly data: readonly DeviceContactLike[] }>;
};

export type DeviceContactsReadResult =
  | { readonly status: 'granted'; readonly entries: readonly DeviceContactImportEntry[] }
  | { readonly status: 'denied' | 'unavailable' | 'failed' };

type DeviceContactsReadOptions = {
  readonly loadContactsModule?: () => Promise<DeviceContactsModule | null>;
};

export async function readDeviceContacts({
  loadContactsModule = loadExpoContactsModule,
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

  try {
    const permission = await contacts.requestPermissionsAsync();

    if (!permission.granted) {
      return { status: 'denied' };
    }

    const result = await contacts.getContactsAsync({
      fields: [contacts.Fields.Emails, contacts.Fields.PhoneNumbers],
      sort: contacts.SortTypes.FirstName,
    });

    return {
      entries: normalizeDeviceContacts(result.data),
      status: 'granted',
    };
  } catch {
    return { status: 'failed' };
  }
}

async function loadExpoContactsModule(): Promise<DeviceContactsModule> {
  return (await import('expo-contacts')) as unknown as DeviceContactsModule;
}
