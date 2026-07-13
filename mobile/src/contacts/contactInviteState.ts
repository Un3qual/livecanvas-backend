export type ContactInviteStatus =
  | 'checking'
  | 'requires_auth'
  | 'consuming'
  | 'consumed'
  | 'invalid'
  | 'retryable_error';

export type ContactInviteState = {
  readonly attemptId: number | null;
  readonly handoffId: string | null;
  readonly status: ContactInviteStatus;
};

export type ContactInviteStateAction =
  | { readonly handoffId: string | null; readonly type: 'route_changed' }
  | {
      readonly attemptId: number;
      readonly handoffId: string | null;
      readonly type: Exclude<ContactInviteStatus, 'checking'>;
    };

export function createContactInviteState(
  handoffId: string | null,
): ContactInviteState {
  return { attemptId: null, handoffId, status: 'checking' };
}

export function readContactInviteHandoffParam(
  rawHandoffId: string | string[] | undefined,
): string | null {
  if (Array.isArray(rawHandoffId)) {
    return null;
  }

  const handoffId = rawHandoffId?.trim();

  return handoffId && /^[A-Za-z0-9_-]{8,128}$/.test(handoffId)
    ? handoffId
    : null;
}

export function contactInviteStateReducer(
  state: ContactInviteState,
  action: ContactInviteStateAction,
): ContactInviteState {
  if (action.type === 'route_changed') {
    return createContactInviteState(action.handoffId);
  }

  if (action.type === 'consuming') {
    if (
      state.handoffId !== action.handoffId ||
      state.status === 'consumed' ||
      state.status === 'invalid'
    ) {
      return state;
    }

    return { ...state, attemptId: action.attemptId, status: 'consuming' };
  }

  if (
    state.handoffId !== action.handoffId ||
    (state.attemptId !== null && state.attemptId !== action.attemptId)
  ) {
    return state;
  }

  return { ...state, attemptId: action.attemptId, status: action.type };
}
