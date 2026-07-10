export type ContactDiscoveryMutationError = {
  readonly field?: string | null;
  readonly message: string;
};

export type ManualEmailContactInput = {
  readonly contactClientId: string;
  readonly contactName: string | null;
  readonly emails: readonly [string];
};

export type ContactInviteInput = {
  readonly recipient: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_EMAIL_ERROR = 'Enter an email address.';
const INVALID_EMAIL_ERROR = 'Enter a valid email address.';
const CONTACT_UPSERT_FALLBACK_ERROR = 'We could not search contacts.';
const CONTACT_INVITE_FALLBACK_ERROR = 'We could not send this invite.';
const CONTACT_UPSERT_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  invalid_contact_client_id: CONTACT_UPSERT_FALLBACK_ERROR,
  unauthenticated: 'Sign in again to search contacts.',
};
const CONTACT_INVITE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  delivery_failed: CONTACT_INVITE_FALLBACK_ERROR,
  invalid_recipient: INVALID_EMAIL_ERROR,
  unauthenticated: 'Sign in again to invite this contact.',
};

export function normalizeContactDiscoveryEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateContactDiscoveryEmail(email: string): string | null {
  const normalizedEmail = normalizeContactDiscoveryEmail(email);

  if (!normalizedEmail) {
    return EMPTY_EMAIL_ERROR;
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return INVALID_EMAIL_ERROR;
  }

  return null;
}

export function buildManualEmailContactInput({
  displayName,
  email,
}: {
  readonly displayName: string;
  readonly email: string;
}): ManualEmailContactInput | null {
  const normalizedEmail = normalizeContactDiscoveryEmail(email);

  if (validateContactDiscoveryEmail(normalizedEmail)) {
    return null;
  }

  const contactName = displayName.trim();

  return {
    contactClientId: `manual-email:${normalizedEmail}`,
    contactName: contactName.length > 0 ? contactName : null,
    emails: [normalizedEmail],
  };
}

export function buildContactInviteInput(
  email: string,
): ContactInviteInput | null {
  const normalizedEmail = normalizeContactDiscoveryEmail(email);

  if (validateContactDiscoveryEmail(normalizedEmail)) {
    return null;
  }

  return { recipient: normalizedEmail };
}

export function contactDiscoveryInviteSentMessage(email: string): string {
  return `Invite sent to ${normalizeContactDiscoveryEmail(email)}.`;
}

export function formatContactUpsertMutationErrors(
  errors: ReadonlyArray<ContactDiscoveryMutationError> | null | undefined,
): string {
  // GraphQL uses error.message as a machine-readable code here, so translate
  // recognized values before any text reaches the viewer.
  const firstKnownMessage = errors?.find((error) =>
    Object.hasOwn(CONTACT_UPSERT_ERROR_MESSAGES, error.message),
  )?.message;

  if (firstKnownMessage) {
    return CONTACT_UPSERT_ERROR_MESSAGES[firstKnownMessage];
  }

  if (errors?.some((error) => isEmailField(error.field))) {
    return INVALID_EMAIL_ERROR;
  }

  return CONTACT_UPSERT_FALLBACK_ERROR;
}

export function formatContactInviteMutationErrors(
  errors: ReadonlyArray<ContactDiscoveryMutationError> | null | undefined,
): string {
  // GraphQL uses error.message as a machine-readable code here, so translate
  // recognized values before any text reaches the viewer.
  const firstKnownMessage = errors?.find((error) =>
    Object.hasOwn(CONTACT_INVITE_ERROR_MESSAGES, error.message),
  )?.message;

  if (firstKnownMessage) {
    return CONTACT_INVITE_ERROR_MESSAGES[firstKnownMessage];
  }

  if (errors?.some((error) => error.field === 'recipient')) {
    return INVALID_EMAIL_ERROR;
  }

  return CONTACT_INVITE_FALLBACK_ERROR;
}

function isEmailField(field: string | null | undefined): boolean {
  return field === 'email' || field === 'emails';
}
