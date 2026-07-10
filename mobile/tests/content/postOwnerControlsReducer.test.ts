import { describe, expect, test } from 'bun:test';

import type { ContentPost } from '../../src/content/contentPostPresentation';
import {
  createPostOwnerControlsState,
  postOwnerControlsReducer,
} from '../../src/content/postOwnerControlsReducer';

describe('postOwnerControlsReducer', () => {
  test('owns the complete edit lifecycle in one state machine', () => {
    const post = contentPost({ id: 'post-1' });
    const editingState = postOwnerControlsReducer(
      createPostOwnerControlsState(),
      { post, type: 'start_edit' },
    );
    const changedState = postOwnerControlsReducer(editingState, {
      bodyText: 'Updated body',
      type: 'edit_body_changed',
    });
    const pendingState = postOwnerControlsReducer(changedState, {
      postId: post.id,
      type: 'update_started',
    });
    const updatedPost = { ...post, bodyText: 'Updated body' };
    const completedState = postOwnerControlsReducer(pendingState, {
      postId: updatedPost.id,
      type: 'update_succeeded',
    });

    expect(changedState.editState?.bodyText).toBe('Updated body');
    expect(pendingState.pendingAction).toEqual({
      kind: 'update',
      postId: 'post-1',
    });
    expect(completedState.editingPostId).toBeNull();
    expect(completedState.editState).toBeNull();
    expect(completedState.pendingAction).toBeNull();
    expect(completedState.deletedPostIds).toEqual({});
    expect(Object.hasOwn(completedState, 'updatedPostsById')).toBe(false);
  });

  test('owns delete confirmation, failure, and local removal transitions', () => {
    const requestedState = postOwnerControlsReducer(
      createPostOwnerControlsState(),
      { postId: 'post-1', type: 'delete_requested' },
    );
    const pendingState = postOwnerControlsReducer(requestedState, {
      postId: 'post-1',
      type: 'delete_started',
    });
    const failedState = postOwnerControlsReducer(pendingState, {
      message: 'Delete failed.',
      postId: 'post-1',
      type: 'delete_failed',
    });
    const retryingState = postOwnerControlsReducer(failedState, {
      postId: 'post-1',
      type: 'delete_started',
    });
    const completedState = postOwnerControlsReducer(retryingState, {
      postId: 'post-1',
      type: 'delete_succeeded',
    });

    expect(requestedState.deleteConfirmationPostId).toBe('post-1');
    expect(failedState.pendingAction).toBeNull();
    expect(failedState.errorsByPostId['post-1']).toBe('Delete failed.');
    expect(completedState.deleteConfirmationPostId).toBeNull();
    expect(completedState.errorsByPostId['post-1']).toBeUndefined();
    expect(completedState.deletedPostIds).toEqual({ 'post-1': true });
  });
});

function contentPost({ id }: { id: string }): ContentPost {
  return {
    author: { email: 'viewer@example.com', id: 'viewer-id' },
    bodyText: 'Original body',
    expiresAt: null,
    id,
    insertedAt: '2026-07-09T12:00:00Z',
    kind: 'STANDARD',
    mediaAssets: [],
    visibility: 'PUBLIC',
  };
}
