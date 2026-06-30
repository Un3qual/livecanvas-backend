export const REPORT_POST_REASONS = [
  'SPAM',
  'HARASSMENT',
  'HATE',
  'VIOLENCE',
  'SEXUAL_CONTENT',
  'SELF_HARM',
  'ILLEGAL',
  'OTHER',
] as const;

export type ReportPostReason = (typeof REPORT_POST_REASONS)[number];

export const DEFAULT_REPORT_POST_REASON: ReportPostReason = 'SPAM';

export type ReportPostMutationError = {
  readonly field?: string | null;
  readonly message: string;
};

export type ReportPostState = {
  readonly activePostId: string | null;
  readonly confirmedPostIds: Readonly<Record<string, true>>;
  readonly errorsByPostId: Readonly<Record<string, string>>;
};

export type ReportPostAction =
  | {
      readonly postId: string;
      readonly type: 'start';
    }
  | {
      readonly postId: string;
      readonly type: 'success';
    }
  | {
      readonly message: string;
      readonly postId: string;
      readonly type: 'error';
    };

const REPORT_POST_FALLBACK_ERROR = 'We could not report this post.';
const REPORT_POST_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  invalid_id: REPORT_POST_FALLBACK_ERROR,
  invalid_type: REPORT_POST_FALLBACK_ERROR,
  not_found: 'This post is no longer available.',
  own_post: 'You cannot report your own post.',
  unauthenticated: 'Sign in again to report this post.',
};

export function createReportPostState(): ReportPostState {
  return {
    activePostId: null,
    confirmedPostIds: {},
    errorsByPostId: {},
  };
}

export function canSubmitPostReport(
  state: ReportPostState,
  postId: string,
): boolean {
  return (
    state.activePostId !== postId &&
    state.confirmedPostIds[postId] !== true
  );
}

export function isPostReportConfirmed(
  state: ReportPostState,
  postId: string,
): boolean {
  return state.confirmedPostIds[postId] === true;
}

export function reportPostReducer(
  state: ReportPostState,
  action: ReportPostAction,
): ReportPostState {
  switch (action.type) {
    case 'start':
      if (state.activePostId !== null || !canSubmitPostReport(state, action.postId)) {
        return state;
      }

      return {
        ...state,
        activePostId: action.postId,
        errorsByPostId: omitPostId(state.errorsByPostId, action.postId),
      };

    case 'success':
      if (state.activePostId !== action.postId) {
        return state;
      }

      return {
        activePostId: null,
        confirmedPostIds: {
          ...state.confirmedPostIds,
          [action.postId]: true,
        },
        errorsByPostId: omitPostId(state.errorsByPostId, action.postId),
      };

    case 'error':
      if (state.activePostId !== null && state.activePostId !== action.postId) {
        return state;
      }

      return {
        ...state,
        activePostId: null,
        errorsByPostId: {
          ...state.errorsByPostId,
          [action.postId]: action.message,
        },
      };

    default:
      return state;
  }
}

export function formatReportPostMutationErrors(
  errors: ReadonlyArray<ReportPostMutationError> | null | undefined,
): string {
  const firstKnownMessage = errors?.find((error) =>
    Object.hasOwn(REPORT_POST_ERROR_MESSAGES, error.message),
  )?.message;

  if (firstKnownMessage) {
    return REPORT_POST_ERROR_MESSAGES[firstKnownMessage];
  }

  return REPORT_POST_FALLBACK_ERROR;
}

function omitPostId(
  values: Readonly<Record<string, string>>,
  postId: string,
): Readonly<Record<string, string>> {
  if (!Object.hasOwn(values, postId)) {
    return values;
  }

  const { [postId]: _removed, ...rest } = values;
  return rest;
}
