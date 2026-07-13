import { describe, expect, test } from 'bun:test';

import {
  beginContactInviteDelivery,
  buildContactInviteInput,
  buildManualEmailContactInput,
  completeContactInviteDelivery,
  createContactInviteDeliveryState,
  formatContactInviteMutationErrors,
  readContactInviteDeliveryStatus,
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

  test('builds invite input without mixing it with upsert state', () => {
    expect(buildContactInviteInput(' contact-match-id ')).toEqual({
      contactMatchId: 'contact-match-id',
    });
    expect(buildContactInviteInput('   ')).toBeNull();
  });

  test('shares invite delivery state across rows with one normalized recipient', () => {
    const initial = createContactInviteDeliveryState();
    const sending = beginContactInviteDelivery(initial, {
      attemptId: 1,
      contactMatchId: 'contact-1',
      recipient: ' Friend@Example.COM ',
    });

    expect(
      readContactInviteDeliveryStatus(
        sending,
        'friend@example.com',
        new Set(['contact-1', 'contact-duplicate']),
      ),
    ).toBe('sending');
    expect(
      readContactInviteDeliveryStatus(
        sending,
        'other@example.com',
        new Set(['contact-2']),
      ),
    ).toBe('idle');

    const sent = completeContactInviteDelivery(sending, {
      attemptId: 1,
      contactMatchId: 'contact-1',
      recipient: 'friend@example.com',
      status: 'sent',
    });

    expect(
      readContactInviteDeliveryStatus(
        sent,
        'friend@example.com',
        new Set(['contact-1', 'contact-duplicate']),
      ),
    ).toBe('sent');
  });

  test('ignores stale invite completions after replacement or a newer retry', () => {
    const firstAttempt = beginContactInviteDelivery(
      createContactInviteDeliveryState(),
      {
        attemptId: 1,
        contactMatchId: 'contact-old',
        recipient: 'friend@example.com',
      },
    );
    const replacementAttempt = beginContactInviteDelivery(firstAttempt, {
      attemptId: 2,
      contactMatchId: 'contact-new',
      recipient: 'friend@example.com',
    });
    const staleCompletion = completeContactInviteDelivery(replacementAttempt, {
      attemptId: 1,
      contactMatchId: 'contact-old',
      recipient: 'friend@example.com',
      status: 'sent',
    });

    expect(staleCompletion).toBe(replacementAttempt);
    expect(
      readContactInviteDeliveryStatus(
        staleCompletion,
        'friend@example.com',
        new Set(['contact-new']),
      ),
    ).toBe('sending');
    expect(
      readContactInviteDeliveryStatus(
        firstAttempt,
        'friend@example.com',
        new Set(['contact-new']),
      ),
    ).toBe('idle');
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
