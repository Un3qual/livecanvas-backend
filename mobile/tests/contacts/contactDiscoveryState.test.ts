import { describe, expect, test } from 'bun:test';

import {
  buildContactInviteInput,
  buildManualEmailContactInput,
  contactDiscoveryInviteSentMessage,
  formatContactInviteMutationErrors,
  formatContactUpsertMutationErrors,
  normalizeContactDiscoveryEmail,
  validateContactDiscoveryEmail,
} from '../../src/contacts/contactDiscoveryState';

describe('contactDiscoveryState', () => {
  test('normalizes manual email input for validation and contact client IDs', () => {
    expect(normalizeContactDiscoveryEmail(' Friend@Example.COM ')).toBe(
      'friend@example.com',
    );
    expect(validateContactDiscoveryEmail(' Friend@Example.COM ')).toBeNull();
    expect(validateContactDiscoveryEmail('')).toBe(
      'Enter an email address.',
    );
    expect(validateContactDiscoveryEmail('invalid-recipient')).toBe(
      'Enter a valid email address.',
    );
  });

  test('builds one-contact upsert input with deterministic manual email ID', () => {
    expect(
      buildManualEmailContactInput({
        displayName: '  Friend Name  ',
        email: ' Friend@Example.COM ',
      }),
    ).toEqual({
      contactClientId: 'manual-email:friend@example.com',
      contactName: 'Friend Name',
      emails: ['friend@example.com'],
    });

    expect(
      buildManualEmailContactInput({
        displayName: '  ',
        email: 'friend@example.com',
      }),
    ).toEqual({
      contactClientId: 'manual-email:friend@example.com',
      contactName: null,
      emails: ['friend@example.com'],
    });

    expect(
      buildManualEmailContactInput({
        displayName: 'Friend',
        email: 'not-an-email',
      }),
    ).toBeNull();
  });

  test('builds invite input and copy without mixing it with upsert state', () => {
    expect(buildContactInviteInput(' Friend@Example.COM ')).toEqual({
      recipient: 'friend@example.com',
    });
    expect(buildContactInviteInput('invalid-recipient')).toBeNull();
    expect(contactDiscoveryInviteSentMessage('Friend@Example.COM')).toBe(
      'Invite sent to friend@example.com.',
    );
  });

  test('formats contact payload errors as viewer-safe copy', () => {
    expect(
      formatContactUpsertMutationErrors([
        { field: null, message: 'unauthenticated' },
      ]),
    ).toBe('Sign in again to search contacts.');
    expect(
      formatContactUpsertMutationErrors([
        { field: 'emails', message: 'is invalid' },
      ]),
    ).toBe('Enter a valid email address.');
    expect(formatContactUpsertMutationErrors([])).toBe(
      'We could not search contacts.',
    );

    expect(
      formatContactInviteMutationErrors([
        { field: null, message: 'unauthenticated' },
      ]),
    ).toBe('Sign in again to invite this contact.');
    expect(
      formatContactInviteMutationErrors([
        { field: 'recipient', message: 'is invalid' },
      ]),
    ).toBe('Enter a valid email address.');
    expect(formatContactInviteMutationErrors([])).toBe(
      'We could not send this invite.',
    );
  });
});
