/** Shared post-input rules used by creation and owner editing surfaces. */
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
  readonly bodyText?: string;
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
const ZERO_WIDTH_JOINER = '\u200d';
const COMBINING_MARK_REGEX = /^\p{Mark}$/u;
const EMOJI_MODIFIER_REGEX = /^[\u{1f3fb}-\u{1f3ff}]$/u;
const REGIONAL_INDICATOR_REGEX = /^[\u{1f1e6}-\u{1f1ff}]$/u;
const VARIATION_SELECTOR_REGEX = /^[\ufe00-\ufe0f\u{e0100}-\u{e01ef}]$/u;

type GraphemeSegmenter = new (
  locale: string,
  options: { granularity: 'grapheme' },
) => { segment: (input: string) => Iterable<unknown> };

type IntlWithSegmenter = typeof Intl & {
  readonly Segmenter?: GraphemeSegmenter;
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

export function canSubmitPostComposer(
  state: PostComposerState,
  hasReadyMedia = false,
): boolean {
  return getPostComposerValidationMessage(state, hasReadyMedia) == null;
}

export function countPostComposerBodyTextCharacters(bodyText: string): number {
  const segmenter = (globalThis.Intl as IntlWithSegmenter | undefined)
    ?.Segmenter;

  if (segmenter) {
    return Array.from(
      new segmenter('en-US', { granularity: 'grapheme' }).segment(bodyText),
    ).length;
  }

  return countFallbackGraphemeClusters(bodyText);
}

export function buildCreatePostInput(
  state: PostComposerState,
  hasReadyMedia = false,
): CreatePostInput | null {
  if (!canSubmitPostComposer(state, hasReadyMedia)) {
    return null;
  }

  const bodyText = state.bodyText.trim();

  return {
    ...(bodyText ? { bodyText } : {}),
    kind: state.kind,
    visibility: state.visibility,
  };
}

export function getPostComposerValidationMessage(
  state: PostComposerState,
  hasReadyMedia = false,
): string | null {
  const bodyText = state.bodyText.trim();

  if (!bodyText && !hasReadyMedia) {
    return EMPTY_BODY_ERROR;
  }

  if (
    countPostComposerBodyTextCharacters(bodyText) >
    POST_COMPOSER_BODY_TEXT_MAX_LENGTH
  ) {
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

function countFallbackGraphemeClusters(bodyText: string): number {
  let count = 0;
  let joinsNextCluster = false;
  let regionalIndicatorRun = 0;

  for (const character of bodyText) {
    if (character === ZERO_WIDTH_JOINER) {
      joinsNextCluster = count > 0;
      continue;
    }

    if (isGraphemeExtender(character)) {
      if (count === 0) {
        count = 1;
      }

      continue;
    }

    if (joinsNextCluster) {
      joinsNextCluster = false;
      regionalIndicatorRun = 0;
      continue;
    }

    if (REGIONAL_INDICATOR_REGEX.test(character)) {
      regionalIndicatorRun += 1;

      if (regionalIndicatorRun % 2 === 1) {
        count += 1;
      }

      continue;
    }

    regionalIndicatorRun = 0;
    count += 1;
  }

  return count;
}

function isGraphemeExtender(character: string): boolean {
  return (
    COMBINING_MARK_REGEX.test(character) ||
    EMOJI_MODIFIER_REGEX.test(character) ||
    VARIATION_SELECTOR_REGEX.test(character)
  );
}
