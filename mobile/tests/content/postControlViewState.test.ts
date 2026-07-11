import { describe, expect, test } from 'bun:test';

import type { ContentPost } from '../../src/content/contentPostPresentation';
import {
  arePostControlViewStatesEqual,
  selectPostControlViewState,
} from '../../src/content/postControlViewState';
import {
  createPostOwnerControlsState,
  postOwnerControlsReducer,
} from '../../src/content/postOwnerControlsReducer';
import { createReportPostState } from '../../src/content/reportPostReducer';

describe('postControlViewState', () => {
  test('changes only the selected post view while an edit body changes', () => {
    const initialOwnerState = createPostOwnerControlsState();
    const editingOwnerState = postOwnerControlsReducer(initialOwnerState, {
      post: contentPost('post-1'),
      type: 'start_edit',
    });
    const changedOwnerState = postOwnerControlsReducer(editingOwnerState, {
      bodyText: 'Updated body',
      type: 'edit_body_changed',
    });
    const report = createReportPostState();
    const initialState = { owner: editingOwnerState, report };
    const changedState = { owner: changedOwnerState, report };

    expect(
      arePostControlViewStatesEqual(
        selectPostControlViewState(initialState, 'post-1'),
        selectPostControlViewState(changedState, 'post-1'),
      ),
    ).toBe(false);
    expect(
      arePostControlViewStatesEqual(
        selectPostControlViewState(initialState, 'post-2'),
        selectPostControlViewState(changedState, 'post-2'),
      ),
    ).toBe(true);
  });
});

function contentPost(id: string): ContentPost {
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
