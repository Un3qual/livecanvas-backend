import { describe, expect, test } from 'vitest';

import {
  MEDIA_POST_PUBLISHING_STAGES,
  canAttachSelectedMedia,
  createMediaPostPublishingState,
  mediaPostPublishingReducer,
  type MediaPostPublishingAction,
  type MediaPostPublishingState,
} from '../../src/content/mediaPostPublishingState';
import type { PickedPostMedia } from '../../src/content/mediaPostSelection';

const selection: PickedPostMedia = {
  file: null,
  fileName: 'photo.jpg',
  fileSize: 1024,
  mediaKind: 'image',
  mimeType: 'image/jpeg',
  uri: 'file:///photo.jpg',
};

function reduce(
  state: MediaPostPublishingState,
  action: MediaPostPublishingAction,
): MediaPostPublishingState {
  return mediaPostPublishingReducer(state, action);
}

describe('mediaPostPublishingReducer', () => {
  test('declares the complete publishing stage contract', () => {
    expect(MEDIA_POST_PUBLISHING_STAGES).toEqual([
      'idle',
      'selecting',
      'selected',
      'requesting',
      'uploading',
      'processing',
      'ready',
      'submitting',
      'succeeded',
      'failed',
      'cancelled',
    ]);

    expect(createMediaPostPublishingState()).toEqual({
      attemptId: 0,
      errorMessage: null,
      mediaAssetId: null,
      selection: null,
      selectionFallback: null,
      stage: 'idle',
      uploadConfirmed: false,
    });
  });

  test('supports the complete legal selection, upload, processing, and submit flow', () => {
    let state = reduce(createMediaPostPublishingState(), {
      type: 'selectionStarted',
    });
    expect(state).toMatchObject({ attemptId: 1, stage: 'selecting' });

    state = reduce(state, {
      attemptId: 1,
      selection,
      type: 'selectionSucceeded',
    });
    expect(state).toMatchObject({ selection, stage: 'selected' });

    state = reduce(state, { type: 'uploadRequested' });
    expect(state).toMatchObject({ attemptId: 2, stage: 'requesting' });

    state = reduce(state, {
      attemptId: 2,
      mediaAssetId: 'opaque-media-id',
      type: 'uploadIntentReceived',
    });
    expect(state).toMatchObject({
      mediaAssetId: 'opaque-media-id',
      stage: 'uploading',
    });

    state = reduce(state, { attemptId: 2, type: 'uploadConfirmed' });
    expect(state).toMatchObject({
      stage: 'processing',
      uploadConfirmed: true,
    });

    state = reduce(state, { attemptId: 2, type: 'processingSucceeded' });
    expect(state).toMatchObject({ stage: 'ready' });
    expect(canAttachSelectedMedia(state)).toBe(true);

    state = reduce(state, { type: 'submissionStarted' });
    expect(state).toMatchObject({ stage: 'submitting' });

    state = reduce(state, { attemptId: 2, type: 'submissionSucceeded' });
    expect(state).toMatchObject({ stage: 'succeeded' });
  });

  test('returns the identical state for duplicate or illegal transitions', () => {
    const initial = createMediaPostPublishingState();
    expect(reduce(initial, { type: 'uploadRequested' })).toBe(initial);

    const selecting = reduce(initial, { type: 'selectionStarted' });
    expect(reduce(selecting, { type: 'selectionStarted' })).toBe(selecting);

    const selected = reduce(selecting, {
      attemptId: selecting.attemptId,
      selection,
      type: 'selectionSucceeded',
    });
    expect(
      reduce(selected, {
        attemptId: selected.attemptId,
        selection,
        type: 'selectionSucceeded',
      }),
    ).toBe(selected);
  });

  test('returns the identical state for every stale asynchronous completion', () => {
    const requesting = reduce(
      reduce(
        reduce(createMediaPostPublishingState(), { type: 'selectionStarted' }),
        { attemptId: 1, selection, type: 'selectionSucceeded' },
      ),
      { type: 'uploadRequested' },
    );

    const staleActions: MediaPostPublishingAction[] = [
      { attemptId: 1, message: 'old', type: 'workflowFailed' },
      {
        attemptId: 1,
        mediaAssetId: 'old-id',
        type: 'uploadIntentReceived',
      },
      { attemptId: 1, type: 'uploadConfirmed' },
      { attemptId: 1, type: 'processingSucceeded' },
      { attemptId: 1, type: 'submissionSucceeded' },
    ];

    for (const action of staleActions) {
      expect(reduce(requesting, action)).toBe(requesting);
    }
  });

  test('preserves a ready asset when submission fails', () => {
    const ready: MediaPostPublishingState = {
      attemptId: 4,
      errorMessage: null,
      mediaAssetId: 'ready-id',
      selection,
      selectionFallback: null,
      stage: 'ready',
      uploadConfirmed: true,
    };

    const submitting = reduce(ready, { type: 'submissionStarted' });
    const recovered = reduce(submitting, {
      attemptId: 4,
      message: 'Try posting again.',
      type: 'submissionFailed',
    });

    expect(recovered).toEqual({
      ...ready,
      errorMessage: 'Try posting again.',
    });
    expect(canAttachSelectedMedia(recovered)).toBe(true);
  });

  test('retries with a fresh asset before confirmed upload and retains it afterward', () => {
    const preConfirmation: MediaPostPublishingState = {
      attemptId: 3,
      errorMessage: 'Upload failed.',
      mediaAssetId: 'discard-me',
      selection,
      selectionFallback: null,
      stage: 'failed',
      uploadConfirmed: false,
    };

    expect(reduce(preConfirmation, { type: 'retryRequested' })).toEqual({
      ...preConfirmation,
      attemptId: 4,
      errorMessage: null,
      mediaAssetId: null,
      stage: 'requesting',
    });

    const postConfirmation: MediaPostPublishingState = {
      ...preConfirmation,
      mediaAssetId: 'retain-me',
      uploadConfirmed: true,
    };

    expect(reduce(postConfirmation, { type: 'retryRequested' })).toEqual({
      ...postConfirmation,
      attemptId: 4,
      errorMessage: null,
      stage: 'processing',
    });
  });

  test('discards a confirmed asset after deterministic finalization rejection', () => {
    const confirmed: MediaPostPublishingState = {
      attemptId: 3,
      errorMessage: null,
      mediaAssetId: 'rejected-id',
      selection,
      selectionFallback: null,
      stage: 'processing',
      uploadConfirmed: true,
    };

    const failed = reduce(confirmed, {
      attemptId: 3,
      discardUpload: true,
      message: 'Choose the media and try again.',
      type: 'workflowFailed',
    });

    expect(failed).toMatchObject({
      mediaAssetId: null,
      stage: 'failed',
      uploadConfirmed: false,
    });
    expect(reduce(failed, { type: 'retryRequested' })).toMatchObject({
      mediaAssetId: null,
      stage: 'requesting',
    });
  });

  test('handles picker cancellation, workflow failure, removal, and explicit cancellation', () => {
    const selecting = reduce(createMediaPostPublishingState(), {
      type: 'selectionStarted',
    });

    expect(
      reduce(selecting, {
        attemptId: selecting.attemptId,
        type: 'selectionCancelled',
      }),
    ).toEqual({
      ...createMediaPostPublishingState(),
      attemptId: selecting.attemptId + 1,
    });

    const failed = reduce(selecting, {
      attemptId: selecting.attemptId,
      message: 'Choose another file.',
      type: 'workflowFailed',
    });
    expect(failed).toMatchObject({
      errorMessage: 'Choose another file.',
      stage: 'failed',
    });

    const cancelled = reduce(failed, { type: 'cancelRequested' });
    expect(cancelled).toMatchObject({
      attemptId: failed.attemptId + 1,
      stage: 'cancelled',
    });
    expect(canAttachSelectedMedia(cancelled)).toBe(false);

    expect(reduce(failed, { type: 'removeRequested' })).toEqual({
      ...createMediaPostPublishingState(),
      attemptId: failed.attemptId + 1,
    });
  });

  test('restores ready media when replacement selection is cancelled', () => {
    const ready: MediaPostPublishingState = {
      attemptId: 4,
      errorMessage: null,
      mediaAssetId: 'ready-id',
      selection,
      selectionFallback: null,
      stage: 'ready',
      uploadConfirmed: true,
    };

    const selectingReplacement = reduce(ready, { type: 'selectionStarted' });
    const restored = reduce(selectingReplacement, {
      attemptId: selectingReplacement.attemptId,
      type: 'selectionCancelled',
    });

    expect(restored).toEqual({
      ...ready,
      attemptId: selectingReplacement.attemptId + 1,
    });
    expect(canAttachSelectedMedia(restored)).toBe(true);
  });
});
