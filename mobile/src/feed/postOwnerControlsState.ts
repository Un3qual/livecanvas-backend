import {
  POST_COMPOSER_BODY_TEXT_MAX_LENGTH,
  type PostComposerVisibility,
  countPostComposerBodyTextCharacters,
} from './postComposerState';

export type PostOwnerEditState = {
  readonly bodyText: string;
  readonly errorMessage: string | null;
  readonly visibility: PostComposerVisibility;
};

export type UpdatePostInput = {
  readonly bodyText: string;
  readonly postId: string;
  readonly visibility: PostComposerVisibility;
};

export type DeletePostInput = {
  readonly postId: string;
};

export type PostOwnerControlMutationError = {
  readonly field?: string | null;
  readonly message: string;
};

export const POST_OWNER_DELETE_CONFIRMATION =
  'Delete this post? This cannot be undone.';

const EMPTY_UPDATE_ERROR = 'Add text before saving.';
const BODY_TOO_LONG_ERROR = 'Posts must be 5,000 characters or fewer.';
const UPDATE_POST_FALLBACK_ERROR = 'We could not update this post.';
const DELETE_POST_FALLBACK_ERROR = 'We could not delete this post.';
const UPDATE_POST_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  invalid_id: UPDATE_POST_FALLBACK_ERROR,
  invalid_type: UPDATE_POST_FALLBACK_ERROR,
  not_found: 'This post is no longer available.',
  unauthenticated: 'Sign in again to edit this post.',
};
const DELETE_POST_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  invalid_id: DELETE_POST_FALLBACK_ERROR,
  invalid_type: DELETE_POST_FALLBACK_ERROR,
  not_found: 'This post is no longer available.',
  unauthenticated: 'Sign in again to delete this post.',
};

export function isViewerOwnedPost(
  viewerId: string | null | undefined,
  postAuthorId: string | null | undefined,
): boolean {
  return viewerId != null && postAuthorId != null && viewerId === postAuthorId;
}

export function buildPostOwnerEditState({
  bodyText,
  visibility,
}: {
  readonly bodyText: string | null | undefined;
  readonly visibility: string | null | undefined;
}): PostOwnerEditState {
  return {
    bodyText: bodyText ?? '',
    errorMessage: null,
    visibility: normalizePostOwnerVisibility(visibility),
  };
}

export function updatePostOwnerEditBody(
  state: PostOwnerEditState,
  bodyText: string,
): PostOwnerEditState {
  return {
    ...state,
    bodyText,
    errorMessage: null,
  };
}

export function selectPostOwnerEditVisibility(
  state: PostOwnerEditState,
  visibility: PostComposerVisibility,
): PostOwnerEditState {
  return {
    ...state,
    errorMessage: null,
    visibility,
  };
}

export function canSubmitPostOwnerUpdate(
  state: PostOwnerEditState,
): boolean {
  return getPostOwnerUpdateValidationMessage(state) == null;
}

export function buildUpdatePostInput(
  postId: string,
  state: PostOwnerEditState,
): UpdatePostInput | null {
  if (!canSubmitPostOwnerUpdate(state)) {
    return null;
  }

  return {
    bodyText: state.bodyText.trim(),
    postId,
    visibility: state.visibility,
  };
}

export function buildDeletePostInput(postId: string): DeletePostInput {
  return { postId };
}

export function getPostOwnerUpdateValidationMessage(
  state: PostOwnerEditState,
): string | null {
  const bodyText = state.bodyText.trim();

  if (!bodyText) {
    return EMPTY_UPDATE_ERROR;
  }

  if (
    countPostComposerBodyTextCharacters(bodyText) >
    POST_COMPOSER_BODY_TEXT_MAX_LENGTH
  ) {
    return BODY_TOO_LONG_ERROR;
  }

  return null;
}

export function formatUpdatePostMutationErrors(
  errors: ReadonlyArray<PostOwnerControlMutationError> | null | undefined,
): string {
  const firstKnownMessage = errors?.find((error) =>
    Object.hasOwn(UPDATE_POST_ERROR_MESSAGES, error.message),
  )?.message;

  if (firstKnownMessage) {
    return UPDATE_POST_ERROR_MESSAGES[firstKnownMessage];
  }

  const bodyError = errors?.find((error) => isBodyTextField(error.field));

  if (bodyError?.message === "can't be blank") {
    return EMPTY_UPDATE_ERROR;
  }

  if (bodyError?.message.startsWith('should be at most ')) {
    return BODY_TOO_LONG_ERROR;
  }

  return UPDATE_POST_FALLBACK_ERROR;
}

export function formatDeletePostMutationErrors(
  errors: ReadonlyArray<PostOwnerControlMutationError> | null | undefined,
): string {
  const firstKnownMessage = errors?.find((error) =>
    Object.hasOwn(DELETE_POST_ERROR_MESSAGES, error.message),
  )?.message;

  if (firstKnownMessage) {
    return DELETE_POST_ERROR_MESSAGES[firstKnownMessage];
  }

  return DELETE_POST_FALLBACK_ERROR;
}

function isBodyTextField(field: string | null | undefined): boolean {
  return field === 'bodyText' || field === 'body_text';
}

function normalizePostOwnerVisibility(
  visibility: string | null | undefined,
): PostComposerVisibility {
  return visibility === 'PUBLIC' ? 'PUBLIC' : 'FOLLOWERS';
}
