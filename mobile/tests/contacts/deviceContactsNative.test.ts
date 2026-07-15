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
    getContactsAsync: () => Promise.resolve({ data: [] }),
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
        return Promise.resolve({ data: [] });
      },
      requestPermissionsAsync: () => Promise.resolve({ granted: false }),
    });

    await expect(
      readDeviceContacts({ loadContactsModule: () => Promise.resolve(module) }),
    ).resolves.toEqual({ status: 'denied' });
    expect(readCalls).toBe(0);
  });

  test('reads only email and phone fields and returns normalized entries', async () => {
    let options: unknown;
    const module = contactsModule({
      getContactsAsync: (receivedOptions) => {
        options = receivedOptions;
        return Promise.resolve({
          data: [
            {
              id: 'native-contact',
              name: 'Native Contact',
              emails: [{ email: 'native@example.com' }],
              phoneNumbers: [{ number: '+16502530000' }],
            },
          ],
        });
      },
    });

    await expect(
      readDeviceContacts({ loadContactsModule: () => Promise.resolve(module) }),
    ).resolves.toEqual({
      entries: [
        {
          contactClientId: 'device:native-contact',
          contactName: 'Native Contact',
          emails: ['native@example.com'],
          phoneNumbers: ['+16502530000'],
        },
      ],
      status: 'granted',
    });
    expect(options).toEqual({
      fields: ['emails', 'phoneNumbers'],
      sort: 'firstName',
    });
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
