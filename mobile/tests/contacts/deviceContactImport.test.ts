import { describe, expect, test } from 'vitest';

import {
  chunkDeviceContactEntries,
  normalizeDeviceContacts,
} from '../../src/contacts/deviceContactImport';

describe('normalizeDeviceContacts', () => {
  test('keeps only the approved fields and normalizes identifiers', () => {
    expect(
      normalizeDeviceContacts([
        {
          id: ' native-1 ',
          name: '  Friend One  ',
          emails: [
            { email: ' FRIEND@Example.com ', label: 'home' },
            { email: 'friend@example.com', label: 'work' },
            { email: ' ', label: 'other' },
          ],
          phoneNumbers: [
            { number: ' +1 650 253 0000 ', label: 'mobile' },
            { number: '+1 650 253 0000', label: 'home' },
            { number: '', label: 'other' },
          ],
          image: { uri: 'file:///private-avatar.jpg' },
          note: 'must not leave the device',
        },
      ]),
    ).toEqual([
      {
        contactClientId: 'device:native-1',
        contactName: 'Friend One',
        emails: ['friend@example.com'],
        phoneNumbers: ['+16502530000'],
      },
    ]);
  });

  test('drops invalid phones without discarding a contact with a valid email', () => {
    expect(
      normalizeDeviceContacts([
        {
          id: 'mixed-contact',
          emails: [{ email: 'mixed@example.com' }],
          phoneNumbers: [
            { number: '123' },
            { number: '(650) 253-0000' },
          ],
        },
        {
          id: 'invalid-phone-only',
          phoneNumbers: [{ number: 'not a phone number' }],
        },
      ]),
    ).toEqual([
      {
        contactClientId: 'device:mixed-contact',
        contactName: null,
        emails: ['mixed@example.com'],
        phoneNumbers: ['+16502530000'],
      },
    ]);
  });

  test('drops blank ids and contacts without an email or phone number', () => {
    expect(
      normalizeDeviceContacts([
        { id: '', name: 'Missing ID', emails: [{ email: 'id@example.com' }] },
        { id: 'empty', name: 'Empty', emails: [], phoneNumbers: [] },
        { id: 'blank', emails: [{ email: ' ' }], phoneNumbers: [{ number: ' ' }] },
        { id: 'kept', name: '  ', emails: [{ email: 'kept@example.com' }] },
      ]),
    ).toEqual([
      {
        contactClientId: 'device:kept',
        contactName: null,
        emails: ['kept@example.com'],
        phoneNumbers: [],
      },
    ]);
  });

  test('preserves native source order', () => {
    expect(
      normalizeDeviceContacts([
        { id: 'third', emails: [{ email: 'third@example.com' }] },
        { id: 'first', emails: [{ email: 'first@example.com' }] },
        { id: 'second', phoneNumbers: [{ number: '+16502530000' }] },
      ]).map((entry) => entry.contactClientId),
    ).toEqual(['device:third', 'device:first', 'device:second']);
  });
});

describe('chunkDeviceContactEntries', () => {
  test('creates stable chunks of at most 100 entries', () => {
    const entries = Array.from({ length: 205 }, (_, index) => ({
      contactClientId: `device:${index}`,
      contactName: null,
      emails: [`person-${index}@example.com`],
      phoneNumbers: [],
    }));

    const chunks = chunkDeviceContactEntries(entries);

    expect(chunks.map((chunk) => chunk.length)).toEqual([100, 100, 5]);
    expect(chunks.flat()).toEqual(entries);
  });

  test('returns no chunks for no importable contacts', () => {
    expect(chunkDeviceContactEntries([])).toEqual([]);
  });
});
