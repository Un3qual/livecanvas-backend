import type { PickedPostMedia } from './mediaPostSelection';

export const MEDIA_POST_PUBLISHING_STAGES = [
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
] as const;

export type MediaPostPublishingStage =
  (typeof MEDIA_POST_PUBLISHING_STAGES)[number];

export type MediaPostPublishingState = {
  readonly attemptId: number;
  readonly errorMessage: string | null;
  readonly mediaAssetId: string | null;
  readonly selection: PickedPostMedia | null;
  readonly stage: MediaPostPublishingStage;
  readonly uploadConfirmed: boolean;
};

type AttemptAction = { readonly attemptId: number };

export type MediaPostPublishingAction =
  | { readonly type: 'selectionStarted' }
  | (AttemptAction & {
      readonly selection: PickedPostMedia;
      readonly type: 'selectionSucceeded';
    })
  | (AttemptAction & { readonly type: 'selectionCancelled' })
  | { readonly type: 'uploadRequested' }
  | (AttemptAction & {
      readonly mediaAssetId: string;
      readonly type: 'uploadIntentReceived';
    })
  | (AttemptAction & { readonly type: 'uploadConfirmed' })
  | (AttemptAction & { readonly type: 'processingSucceeded' })
  | { readonly type: 'submissionStarted' }
  | (AttemptAction & { readonly type: 'submissionSucceeded' })
  | (AttemptAction & {
      readonly message: string;
      readonly type: 'submissionFailed';
    })
  | (AttemptAction & {
      readonly message: string;
      readonly type: 'workflowFailed';
    })
  | { readonly type: 'retryRequested' }
  | { readonly type: 'removeRequested' }
  | { readonly type: 'cancelRequested' };

export function createMediaPostPublishingState(): MediaPostPublishingState {
  return {
    attemptId: 0,
    errorMessage: null,
    mediaAssetId: null,
    selection: null,
    stage: 'idle',
    uploadConfirmed: false,
  };
}

export function canAttachSelectedMedia(
  state: MediaPostPublishingState,
): boolean {
  return (
    state.stage === 'ready' &&
    state.selection != null &&
    state.mediaAssetId != null &&
    state.uploadConfirmed
  );
}

export function mediaPostPublishingReducer(
  state: MediaPostPublishingState,
  action: MediaPostPublishingAction,
): MediaPostPublishingState {
  if ('attemptId' in action && action.attemptId !== state.attemptId) {
    return state;
  }

  switch (action.type) {
    case 'selectionStarted':
      return canStartSelection(state)
        ? {
            ...createMediaPostPublishingState(),
            attemptId: state.attemptId + 1,
            stage: 'selecting',
          }
        : state;

    case 'selectionSucceeded':
      return state.stage === 'selecting'
        ? {
            ...state,
            errorMessage: null,
            selection: action.selection,
            stage: 'selected',
          }
        : state;

    case 'selectionCancelled':
      return state.stage === 'selecting'
        ? resetStateAfter(state)
        : state;

    case 'uploadRequested':
      return state.stage === 'selected' && state.selection
        ? {
            ...state,
            attemptId: state.attemptId + 1,
            errorMessage: null,
            mediaAssetId: null,
            stage: 'requesting',
            uploadConfirmed: false,
          }
        : state;

    case 'uploadIntentReceived':
      return state.stage === 'requesting' && action.mediaAssetId.length > 0
        ? {
            ...state,
            mediaAssetId: action.mediaAssetId,
            stage: 'uploading',
          }
        : state;

    case 'uploadConfirmed':
      return state.stage === 'uploading' && state.mediaAssetId
        ? { ...state, stage: 'processing', uploadConfirmed: true }
        : state;

    case 'processingSucceeded':
      return state.stage === 'processing' && state.mediaAssetId
        ? { ...state, errorMessage: null, stage: 'ready' }
        : state;

    case 'submissionStarted':
      return canAttachSelectedMedia(state)
        ? { ...state, errorMessage: null, stage: 'submitting' }
        : state;

    case 'submissionSucceeded':
      return state.stage === 'submitting'
        ? { ...state, errorMessage: null, stage: 'succeeded' }
        : state;

    case 'submissionFailed':
      return state.stage === 'submitting'
        ? { ...state, errorMessage: action.message, stage: 'ready' }
        : state;

    case 'workflowFailed':
      return canFailWorkflow(state)
        ? { ...state, errorMessage: action.message, stage: 'failed' }
        : state;

    case 'retryRequested':
      return retryState(state);

    case 'removeRequested':
      return canRemoveSelection(state) ? resetStateAfter(state) : state;

    case 'cancelRequested':
      return canCancel(state)
        ? {
            ...state,
            attemptId: state.attemptId + 1,
            errorMessage: null,
            stage: 'cancelled',
          }
        : state;
  }
}

function canStartSelection(state: MediaPostPublishingState): boolean {
  return ['idle', 'selected', 'ready', 'failed', 'cancelled', 'succeeded'].includes(
    state.stage,
  );
}

function canFailWorkflow(state: MediaPostPublishingState): boolean {
  return ['selecting', 'requesting', 'uploading', 'processing'].includes(
    state.stage,
  );
}

function canRemoveSelection(state: MediaPostPublishingState): boolean {
  return !['requesting', 'uploading', 'processing', 'submitting'].includes(
    state.stage,
  );
}

function canCancel(state: MediaPostPublishingState): boolean {
  return ['selecting', 'requesting', 'uploading', 'processing', 'submitting'].includes(
    state.stage,
  ) || state.stage === 'failed';
}

function retryState(state: MediaPostPublishingState): MediaPostPublishingState {
  if (state.stage !== 'failed') {
    return state;
  }

  if (!state.selection) {
    return resetStateAfter(state);
  }

  if (state.uploadConfirmed && state.mediaAssetId) {
    return {
      ...state,
      attemptId: state.attemptId + 1,
      errorMessage: null,
      stage: 'processing',
    };
  }

  return {
    ...state,
    attemptId: state.attemptId + 1,
    errorMessage: null,
    mediaAssetId: null,
    stage: 'requesting',
  };
}

function resetStateAfter(
  state: MediaPostPublishingState,
): MediaPostPublishingState {
  return {
    ...createMediaPostPublishingState(),
    attemptId: state.attemptId + 1,
  };
}
