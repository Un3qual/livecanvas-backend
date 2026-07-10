import { describe, expect, test } from 'bun:test';

import {
  POST_OWNER_DELETE_CONFIRMATION,
  buildDeletePostInput,
  buildPostOwnerEditState,
  buildUpdatePostInput,
  canSubmitPostOwnerUpdate,
  formatDeletePostMutationErrors,
  formatUpdatePostMutationErrors,
  getPostOwnerUpdateValidationMessage,
  isViewerOwnedPost,
  selectPostOwnerEditVisibility,
  updatePostOwnerEditBody,
} from '../../src/content/postOwnerControlsState';
import { POST_COMPOSER_BODY_TEXT_MAX_LENGTH } from '../../src/content/postComposerState';

describe('postOwnerControlsState', () => {
  test('checks ownership using opaque Relay ID equality only', () => {
    expect(isViewerOwnedPost('user-relay-id', 'user-relay-id')).toBe(true);
    expect(isViewerOwnedPost('user-relay-id', 'other-relay-id')).toBe(false);
    expect(isViewerOwnedPost(null, 'user-relay-id')).toBe(false);
    expect(isViewerOwnedPost('user-relay-id', null)).toBe(false);
  });

  test('builds trimmed update input from editable body and visibility state', () => {
    const initialState = buildPostOwnerEditState({
      bodyText: 'old body',
      visibility: 'FOLLOWERS',
    });
    const editedState = selectPostOwnerEditVisibility(
      updatePostOwnerEditBody(initialState, '  updated body  '),
      'PUBLIC',
    );

    expect(canSubmitPostOwnerUpdate(editedState)).toBe(true);
    expect(getPostOwnerUpdateValidationMessage(editedState)).toBeNull();
    expect(buildUpdatePostInput('post-relay-id', editedState)).toEqual({
      bodyText: 'updated body',
      postId: 'post-relay-id',
      visibility: 'PUBLIC',
    });
  });

  test('blocks empty and oversized updates before committing mutations', () => {
    const emptyState = updatePostOwnerEditBody(
      buildPostOwnerEditState({ bodyText: 'old body', visibility: 'PUBLIC' }),
      '   ',
    );
    const oversizedState = updatePostOwnerEditBody(
      buildPostOwnerEditState({ bodyText: 'old body', visibility: 'PUBLIC' }),
      'x'.repeat(POST_COMPOSER_BODY_TEXT_MAX_LENGTH + 1),
    );

    expect(canSubmitPostOwnerUpdate(emptyState)).toBe(false);
    expect(buildUpdatePostInput('post-relay-id', emptyState)).toBeNull();
    expect(getPostOwnerUpdateValidationMessage(emptyState)).toBe(
      'Add text before saving.',
    );

    expect(canSubmitPostOwnerUpdate(oversizedState)).toBe(false);
    expect(buildUpdatePostInput('post-relay-id', oversizedState)).toBeNull();
    expect(getPostOwnerUpdateValidationMessage(oversizedState)).toBe(
      'Posts must be 5,000 characters or fewer.',
    );
  });

  test('maps update and delete payload errors to viewer-safe copy', () => {
    expect(
      formatUpdatePostMutationErrors([
        { field: null, message: 'unauthenticated' },
      ]),
    ).toBe('Sign in again to edit this post.');
    expect(
      formatUpdatePostMutationErrors([
        { field: 'postId', message: 'not_found' },
      ]),
    ).toBe('This post is no longer available.');
    expect(
      formatUpdatePostMutationErrors([
        { field: 'body_text', message: "can't be blank" },
      ]),
    ).toBe('Add text before saving.');
    expect(
      formatUpdatePostMutationErrors([
        { field: 'body_text', message: 'should be at most 5000 character(s)' },
      ]),
    ).toBe('Posts must be 5,000 characters or fewer.');
    expect(
      formatUpdatePostMutationErrors([{ field: 'postId', message: 'bogus' }]),
    ).toBe('We could not update this post.');

    expect(
      formatDeletePostMutationErrors([
        { field: null, message: 'unauthenticated' },
      ]),
    ).toBe('Sign in again to delete this post.');
    expect(
      formatDeletePostMutationErrors([
        { field: 'postId', message: 'not_found' },
      ]),
    ).toBe('This post is no longer available.');
    expect(formatDeletePostMutationErrors([])).toBe(
      'We could not delete this post.',
    );
  });

  test('keeps delete confirmation and input construction centralized', () => {
    expect(POST_OWNER_DELETE_CONFIRMATION).toBe(
      'Delete this post? This cannot be undone.',
    );
    expect(buildDeletePostInput('post-relay-id')).toEqual({
      postId: 'post-relay-id',
    });
  });
});
