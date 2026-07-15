import { describe, expect, test } from 'vitest';

import {
  accountDeletionStatusLabel,
  canCancelAccountDeletionRequest,
  dataExportStatusLabel,
  formatAccountSettingsMutationErrors,
  identityProviderLabel,
} from '../../src/account/accountSettingsState';

describe('accountSettingsState', () => {
  test('formats linked identity providers with stable fallbacks', () => {
    expect(
      identityProviderLabel({
        authProvider: 'GOOGLE',
        provider: 'google_provider',
      }),
    ).toBe('Google');
    expect(
      identityProviderLabel({
        authProvider: null,
        provider: 'legacy_provider',
      }),
    ).toBe('legacy provider');
  });

  test('formats data export and account deletion request statuses', () => {
    expect(dataExportStatusLabel('PENDING')).toBe('Pending');
    expect(dataExportStatusLabel('COMPLETED')).toBe('Completed');
    expect(dataExportStatusLabel('%future added value')).toBe(
      'Status unavailable',
    );
    expect(accountDeletionStatusLabel('SCHEDULED')).toBe('Scheduled');
    expect(accountDeletionStatusLabel('CANCELED')).toBe('Canceled');
  });

  test('allows cancellation only before processing starts', () => {
    expect(canCancelAccountDeletionRequest('PENDING')).toBe(true);
    expect(canCancelAccountDeletionRequest('SCHEDULED')).toBe(true);
    expect(canCancelAccountDeletionRequest('PROCESSING')).toBe(false);
    expect(canCancelAccountDeletionRequest('COMPLETED')).toBe(false);
  });

  test('formats mutation errors without decoding ids', () => {
    expect(
      formatAccountSettingsMutationErrors([
        { field: 'accountDeletionRequestId', message: 'not_found' },
      ]),
    ).toBe('accountDeletionRequestId: not_found');
    expect(formatAccountSettingsMutationErrors(null)).toBe(
      'We could not update account settings.',
    );
  });
});
