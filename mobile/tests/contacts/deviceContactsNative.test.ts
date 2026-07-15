import { describe, expect, test } from 'vitest';

import {
  readDeviceContacts,
  type DeviceContactsModule,
} from '../../src/contacts/deviceContactsNative';

function contactsModule(
  overrides: Partial<DeviceContactsModule> = {},
): DeviceContactsModule {
  return {
    Fields: {
      Emails: 'emails',
      PhoneNumbers: 'phoneNumbers',
    },
    SortTypes: {
      FirstName: 'firstName',
    },
    getContactsAsync: () =>
      Promise.resolve({ data: [], hasNextPage: false }),
    requestPermissionsAsync: () => Promise.resolve({ granted: true }),
    ...overrides,
  };
}

describe('readDeviceContacts', () => {
  test('returns unavailable when the native module cannot load', async () => {
    await expect(
      readDeviceContacts({
        loadContactsModule: () => Promise.reject(new Error('missing module')),
      }),
    ).resolves.toEqual({ status: 'unavailable' });
  });

  test('requests permission and does not read contacts when denied', async () => {
    let readCalls = 0;
    const module = contactsModule({
      getContactsAsync: () => {
        readCalls += 1;
        return Promise.resolve({ data: [], hasNextPage: false });
      },
      requestPermissionsAsync: () => Promise.resolve({ granted: false }),
    });

    await expect(
      readDeviceContacts({ loadContactsModule: () => Promise.resolve(module) }),
    ).resolves.toEqual({ status: 'denied' });
    expect(readCalls).toBe(0);
  });

  test('reads bounded pages and releases each normalized page to the consumer', async () => {
    const options: unknown[] = [];
    const releasedPages: unknown[] = [];
    const module = contactsModule({
      getContactsAsync: (receivedOptions) => {
        options.push(receivedOptions);
        const pageOffset = receivedOptions.pageOffset;

        return Promise.resolve(
          pageOffset === 0
            ? {
                data: [
                  {
                    id: 'native-contact-1',
                    name: 'Native Contact 1',
                    emails: [{ email: 'one@example.com' }],
                  },
                ],
                hasNextPage: true,
              }
            : {
                data: [
                  {
                    id: 'native-contact-2',
                    name: 'Native Contact 2',
                    phoneNumbers: [{ number: '+16502530000' }],
                  },
                ],
                hasNextPage: false,
              },
        );
      },
    });

    await expect(
      readDeviceContacts({
        loadContactsModule: () => Promise.resolve(module),
        onEntries: (entries) => {
          releasedPages.push(entries);
        },
      }),
    ).resolves.toEqual({
      entryCount: 2,
      status: 'granted',
    });
    expect(options).toEqual([
      {
        fields: ['emails', 'phoneNumbers'],
        pageOffset: 0,
        pageSize: 100,
        sort: 'firstName',
      },
      {
        fields: ['emails', 'phoneNumbers'],
        pageOffset: 1,
        pageSize: 100,
        sort: 'firstName',
      },
    ]);
    expect(releasedPages).toEqual([
      [
        {
          contactClientId: 'device:native-contact-1',
          contactName: 'Native Contact 1',
          emails: ['one@example.com'],
          phoneNumbers: [],
        },
      ],
      [
        {
          contactClientId: 'device:native-contact-2',
          contactName: 'Native Contact 2',
          emails: [],
          phoneNumbers: ['+16502530000'],
        },
      ],
    ]);
  });

  test('does not swallow consumer upload failures as native read failures', async () => {
    const uploadFailure = new Error('upload failed');
    const module = contactsModule({
      getContactsAsync: () =>
        Promise.resolve({
          data: [{ id: 'native-contact', emails: [{ email: 'one@example.com' }] }],
          hasNextPage: false,
        }),
    });

    await expect(
      readDeviceContacts({
        loadContactsModule: () => Promise.resolve(module),
        onEntries: () => Promise.reject(uploadFailure),
      }),
    ).rejects.toBe(uploadFailure);
  });

  test('maps permission and contact-read failures to failed', async () => {
    const permissionFailure = contactsModule({
      requestPermissionsAsync: () => Promise.reject(new Error('permission failed')),
    });
    const readFailure = contactsModule({
      getContactsAsync: () => Promise.reject(new Error('read failed')),
    });

    await expect(
      readDeviceContacts({
        loadContactsModule: () => Promise.resolve(permissionFailure),
      }),
    ).resolves.toEqual({ status: 'failed' });
    await expect(
      readDeviceContacts({ loadContactsModule: () => Promise.resolve(readFailure) }),
    ).resolves.toEqual({ status: 'failed' });
  });
});
