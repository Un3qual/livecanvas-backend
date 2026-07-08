import { formatMutationErrors, type MutationError } from '../profile/mutationErrors';

export type DataExportStatus =
  | 'COMPLETED'
  | 'FAILED'
  | 'PENDING'
  | 'PROCESSING'
  | '%future added value';

export type AccountDeletionStatus =
  | 'CANCELED'
  | 'COMPLETED'
  | 'FAILED'
  | 'PENDING'
  | 'PROCESSING'
  | 'SCHEDULED'
  | '%future added value';

export function identityProviderLabel({
  authProvider,
  provider,
}: {
  authProvider?: string | null;
  provider: string;
}): string {
  switch (authProvider) {
    case 'APPLE':
      return 'Apple';

    case 'GOOGLE':
      return 'Google';

    case 'MAGIC_LINK':
      return 'Magic link';

    case 'PASSKEY':
      return 'Passkey';

    case 'PASSWORD':
      return 'Password';

    default:
      return provider.replace(/_/g, ' ');
  }
}

export function dataExportStatusLabel(status: DataExportStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';

    case 'PROCESSING':
      return 'Processing';

    case 'COMPLETED':
      return 'Completed';

    case 'FAILED':
      return 'Failed';

    default:
      return 'Status unavailable';
  }
}

export function accountDeletionStatusLabel(
  status: AccountDeletionStatus,
): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';

    case 'SCHEDULED':
      return 'Scheduled';

    case 'PROCESSING':
      return 'Processing';

    case 'COMPLETED':
      return 'Completed';

    case 'FAILED':
      return 'Failed';

    case 'CANCELED':
      return 'Canceled';

    default:
      return 'Status unavailable';
  }
}

export function canCancelAccountDeletionRequest(
  status: AccountDeletionStatus,
): boolean {
  return status === 'PENDING' || status === 'SCHEDULED';
}

export function formatAccountSettingsMutationErrors(
  errors: ReadonlyArray<MutationError> | null | undefined,
): string {
  return formatMutationErrors(errors, 'We could not update account settings.');
}
