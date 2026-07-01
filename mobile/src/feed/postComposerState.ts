export const POST_COMPOSER_KINDS = ['STANDARD', 'STORY'] as const;
export type PostComposerKind = (typeof POST_COMPOSER_KINDS)[number];

export const POST_COMPOSER_VISIBILITIES = ['FOLLOWERS', 'PUBLIC'] as const;
export type PostComposerVisibility =
  (typeof POST_COMPOSER_VISIBILITIES)[number];

export const DEFAULT_POST_COMPOSER_KIND: PostComposerKind = 'STANDARD';
export const DEFAULT_POST_COMPOSER_VISIBILITY: PostComposerVisibility =
  'FOLLOWERS';
export const POST_COMPOSER_BODY_TEXT_MAX_LENGTH = 5000;

export type PostComposerState = {
  readonly bodyText: string;
  readonly errorMessage: string | null;
  readonly kind: PostComposerKind;
  readonly visibility: PostComposerVisibility;
};

export type CreatePostInput = {
  readonly bodyText: string;
  readonly kind: PostComposerKind;
  readonly visibility: PostComposerVisibility;
};

export type CreatePostMutationError = {
  readonly field?: string | null;
  readonly message: string;
};

const EMPTY_BODY_ERROR = 'Add text before posting.';
const BODY_TOO_LONG_ERROR = 'Posts must be 5,000 characters or fewer.';
const CREATE_POST_FALLBACK_ERROR = 'We could not create this post.';
const CREATE_POST_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  unauthenticated: 'Sign in again to create a post.',
};

export function createPostComposerState(): PostComposerState {
  return {
    bodyText: '',
    errorMessage: null,
    kind: DEFAULT_POST_COMPOSER_KIND,
    visibility: DEFAULT_POST_COMPOSER_VISIBILITY,
  };
}

export function updatePostComposerBody(
  state: PostComposerState,
  bodyText: string,
): PostComposerState {
  return {
    ...state,
    bodyText,
    errorMessage: null,
  };
}

export function selectPostComposerKind(
  state: PostComposerState,
  kind: PostComposerKind,
): PostComposerState {
  return {
    ...state,
    errorMessage: null,
    kind,
  };
}

export function selectPostComposerVisibility(
  state: PostComposerState,
  visibility: PostComposerVisibility,
): PostComposerState {
  return {
    ...state,
    errorMessage: null,
    visibility,
  };
}

export function canSubmitPostComposer(state: PostComposerState): boolean {
  return getPostComposerValidationMessage(state) == null;
}

export function buildCreatePostInput(
  state: PostComposerState,
): CreatePostInput | null {
  if (!canSubmitPostComposer(state)) {
    return null;
  }

  return {
    bodyText: state.bodyText.trim(),
    kind: state.kind,
    visibility: state.visibility,
  };
}

export function getPostComposerValidationMessage(
  state: PostComposerState,
): string | null {
  const bodyText = state.bodyText.trim();

  if (!bodyText) {
    return EMPTY_BODY_ERROR;
  }

  if (bodyText.length > POST_COMPOSER_BODY_TEXT_MAX_LENGTH) {
    return BODY_TOO_LONG_ERROR;
  }

  return null;
}

export function formatCreatePostMutationErrors(
  errors: ReadonlyArray<CreatePostMutationError> | null | undefined,
): string {
  const firstKnownMessage = errors?.find((error) =>
    Object.hasOwn(CREATE_POST_ERROR_MESSAGES, error.message),
  )?.message;

  if (firstKnownMessage) {
    return CREATE_POST_ERROR_MESSAGES[firstKnownMessage];
  }

  const bodyError = errors?.find((error) => isBodyTextField(error.field));

  if (bodyError?.message === "can't be blank") {
    return EMPTY_BODY_ERROR;
  }

  if (bodyError?.message.startsWith('should be at most ')) {
    return BODY_TOO_LONG_ERROR;
  }

  return CREATE_POST_FALLBACK_ERROR;
}

function isBodyTextField(field: string | null | undefined): boolean {
  return field === 'bodyText' || field === 'body_text';
}
