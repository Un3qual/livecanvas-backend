import { describe, expect, test } from 'vitest';

import {
  DEFAULT_POST_COMPOSER_KIND,
  DEFAULT_POST_COMPOSER_VISIBILITY,
  POST_COMPOSER_BODY_TEXT_MAX_LENGTH,
  POST_COMPOSER_KINDS,
  POST_COMPOSER_VISIBILITIES,
  buildCreatePostInput,
  canSubmitPostComposer,
  countPostComposerBodyTextCharacters,
  createPostComposerState,
  formatCreatePostMutationErrors,
  getPostComposerValidationMessage,
  selectPostComposerKind,
  selectPostComposerVisibility,
  updatePostComposerBody,
} from '../../src/content/postComposerState';

describe('postComposerState', () => {
  test('creates a default followers-visible standard draft and blocks empty submission', () => {
    const initialState = createPostComposerState();

    expect(DEFAULT_POST_COMPOSER_KIND).toBe('STANDARD');
    expect(DEFAULT_POST_COMPOSER_VISIBILITY).toBe('FOLLOWERS');
    expect(POST_COMPOSER_KINDS).toEqual(['STANDARD', 'STORY']);
    expect(POST_COMPOSER_VISIBILITIES).toEqual(['FOLLOWERS', 'PUBLIC']);
    expect(initialState).toEqual({
      bodyText: '',
      errorMessage: null,
      kind: 'STANDARD',
      visibility: 'FOLLOWERS',
    });
    expect(canSubmitPostComposer(initialState)).toBe(false);
    expect(buildCreatePostInput(initialState)).toBeNull();
    expect(getPostComposerValidationMessage(initialState)).toBe(
      'Add text before posting.',
    );

    const filledState = updatePostComposerBody(
      initialState,
      '  first mobile post  ',
    );

    expect(canSubmitPostComposer(filledState)).toBe(true);
    expect(buildCreatePostInput(filledState)).toEqual({
      bodyText: 'first mobile post',
      kind: 'STANDARD',
      visibility: 'FOLLOWERS',
    });
    expect(getPostComposerValidationMessage(filledState)).toBeNull();
  });

  test('maps kind and visibility selections to createPost enum values', () => {
    const storyState = selectPostComposerVisibility(
      selectPostComposerKind(
        updatePostComposerBody(createPostComposerState(), 'story update'),
        'STORY',
      ),
      'PUBLIC',
    );

    expect(buildCreatePostInput(storyState)).toEqual({
      bodyText: 'story update',
      kind: 'STORY',
      visibility: 'PUBLIC',
    });

    expect(selectPostComposerKind(storyState, 'STANDARD').kind).toBe(
      'STANDARD',
    );
    expect(selectPostComposerVisibility(storyState, 'FOLLOWERS').visibility).toBe(
      'FOLLOWERS',
    );
  });

  test('permits media-only publishing and omits a blank body', () => {
    const state = selectPostComposerKind(createPostComposerState(), 'STORY');

    expect(canSubmitPostComposer(state)).toBe(false);
    expect(canSubmitPostComposer(state, true)).toBe(true);
    expect(getPostComposerValidationMessage(state, true)).toBeNull();
    expect(buildCreatePostInput(state, true)).toEqual({
      kind: 'STORY',
      visibility: 'FOLLOWERS',
    });
  });

  test('keeps trimmed body text when ready media accompanies the post', () => {
    const state = updatePostComposerBody(
      createPostComposerState(),
      '  A view worth sharing  ',
    );

    expect(buildCreatePostInput(state, true)).toEqual({
      bodyText: 'A view worth sharing',
      kind: 'STANDARD',
      visibility: 'FOLLOWERS',
    });
  });

  test('rejects drafts over the backend body length limit', () => {
    const oversizedState = updatePostComposerBody(
      createPostComposerState(),
      'x'.repeat(POST_COMPOSER_BODY_TEXT_MAX_LENGTH + 1),
    );

    expect(canSubmitPostComposer(oversizedState)).toBe(false);
    expect(buildCreatePostInput(oversizedState)).toBeNull();
    expect(getPostComposerValidationMessage(oversizedState)).toBe(
      'Posts must be 5,000 characters or fewer.',
    );
  });

  test('counts astral emoji as one backend character for validation', () => {
    const maxEmojiBody = '😀'.repeat(POST_COMPOSER_BODY_TEXT_MAX_LENGTH);
    const maxEmojiState = updatePostComposerBody(
      createPostComposerState(),
      maxEmojiBody,
    );

    expect(canSubmitPostComposer(maxEmojiState)).toBe(true);
    expect(buildCreatePostInput(maxEmojiState)?.bodyText).toBe(maxEmojiBody);
    expect(getPostComposerValidationMessage(maxEmojiState)).toBeNull();

    const oversizedEmojiState = updatePostComposerBody(
      createPostComposerState(),
      `${maxEmojiBody}😀`,
    );

    expect(canSubmitPostComposer(oversizedEmojiState)).toBe(false);
    expect(buildCreatePostInput(oversizedEmojiState)).toBeNull();
    expect(getPostComposerValidationMessage(oversizedEmojiState)).toBe(
      'Posts must be 5,000 characters or fewer.',
    );
  });

  test('counts emoji modifiers and joined sequences consistently without Intl.Segmenter', () => {
    expect(countPostComposerBodyTextCharacters('👍🏽')).toBe(1);
    expect(countPostComposerBodyTextCharacters('👨‍👩‍👧‍👦')).toBe(1);

    const originalIntl = globalThis.Intl;

    try {
      Object.defineProperty(globalThis, 'Intl', {
        configurable: true,
        value: undefined,
      });

      expect(countPostComposerBodyTextCharacters('👍🏽')).toBe(1);
      expect(countPostComposerBodyTextCharacters('👨‍👩‍👧‍👦')).toBe(1);
    } finally {
      Object.defineProperty(globalThis, 'Intl', {
        configurable: true,
        value: originalIntl,
      });
    }
  });

  test('formats known createPost payload errors as viewer-safe copy', () => {
    const examples = [
      {
        errors: [{ field: null, message: 'unauthenticated' }],
        message: 'Sign in again to create a post.',
      },
      {
        errors: [{ field: 'body_text', message: "can't be blank" }],
        message: 'Add text before posting.',
      },
      {
        errors: [
          {
            field: 'body_text',
            message: 'should be at most 5000 character(s)',
          },
        ],
        message: 'Posts must be 5,000 characters or fewer.',
      },
      {
        errors: [{ field: 'kind', message: 'is invalid' }],
        message: 'We could not create this post.',
      },
    ] as const;

    for (const example of examples) {
      expect(formatCreatePostMutationErrors(example.errors)).toBe(
        example.message,
      );
    }

    expect(formatCreatePostMutationErrors([])).toBe(
      'We could not create this post.',
    );
  });
});
