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
  readonly contactMatchId: string;
};

export type ContactInviteDeliveryStatus =
  | 'idle'
  | 'sending'
  | 'sent'
  | 'retryable_error'
  | 'terminal_invalid_recipient';

type ContactInviteDelivery = {
  readonly attemptId: number;
  readonly contactMatchId: string;
  readonly status: Exclude<ContactInviteDeliveryStatus, 'idle'>;
};

export type ContactInviteDeliveryState = Readonly<
  Record<string, ContactInviteDelivery>
>;

type ContactInviteDeliveryAttempt = {
  readonly attemptId: number;
  readonly contactMatchId: string;
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
  invalid_contact_match: INVALID_EMAIL_ERROR,
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

export function buildContactInviteInput(contactMatchId: string): ContactInviteInput | null {
  const normalizedContactMatchId = contactMatchId.trim();

  return normalizedContactMatchId
    ? { contactMatchId: normalizedContactMatchId }
    : null;
}

export function createContactInviteDeliveryState(): ContactInviteDeliveryState {
  return {};
}

export function beginContactInviteDelivery(
  state: ContactInviteDeliveryState,
  attempt: ContactInviteDeliveryAttempt,
): ContactInviteDeliveryState {
  const recipient = normalizeContactDiscoveryEmail(attempt.recipient);

  return {
    ...state,
    [recipient]: {
      attemptId: attempt.attemptId,
      contactMatchId: attempt.contactMatchId,
      status: 'sending',
    },
  };
}

export function completeContactInviteDelivery(
  state: ContactInviteDeliveryState,
  completion: ContactInviteDeliveryAttempt & {
    readonly status: Exclude<ContactInviteDeliveryStatus, 'idle' | 'sending'>;
  },
): ContactInviteDeliveryState {
  const recipient = normalizeContactDiscoveryEmail(completion.recipient);
  const current = state[recipient];

  if (
    current?.attemptId !== completion.attemptId ||
    current.contactMatchId !== completion.contactMatchId
  ) {
    return state;
  }

  return {
    ...state,
    [recipient]: { ...current, status: completion.status },
  };
}

export function readContactInviteDeliveryStatus(
  state: ContactInviteDeliveryState,
  recipient: string,
  currentContactMatchIds: ReadonlySet<string>,
): ContactInviteDeliveryStatus {
  const delivery = state[normalizeContactDiscoveryEmail(recipient)];

  return delivery && currentContactMatchIds.has(delivery.contactMatchId)
    ? delivery.status
    : 'idle';
}

export function contactInviteDeliveryFailureStatus(
  errors: ReadonlyArray<ContactDiscoveryMutationError> | null | undefined,
): 'retryable_error' | 'terminal_invalid_recipient' {
  return errors?.some(
    (error) =>
      error.message === 'invalid_contact_match' ||
      error.message === 'invalid_recipient' ||
      error.field === 'contactMatchId' ||
      error.field === 'recipient',
  )
    ? 'terminal_invalid_recipient'
    : 'retryable_error';
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
