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
  readonly selectionFallback: MediaPostSelectionFallback | null;
  readonly stage: MediaPostPublishingStage;
  readonly uploadConfirmed: boolean;
};

type MediaPostSelectionFallback = {
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
      readonly discardUpload?: boolean;
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
    selectionFallback: null,
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

  return (
    reduceSelectionAction(state, action) ??
    reduceUploadAction(state, action) ??
    reduceSubmissionAction(state, action) ??
    reduceWorkflowAction(state, action)
  );
}

function reduceSelectionAction(
  state: MediaPostPublishingState,
  action: MediaPostPublishingAction,
): MediaPostPublishingState | null {
  switch (action.type) {
    case 'selectionStarted':
      return canStartSelection(state)
        ? {
            ...createMediaPostPublishingState(),
            attemptId: state.attemptId + 1,
            selectionFallback: selectionFallbackFor(state),
            stage: 'selecting',
          }
        : state;

    case 'selectionSucceeded':
      return state.stage === 'selecting'
        ? {
            ...createMediaPostPublishingState(),
            attemptId: state.attemptId,
            selection: action.selection,
            stage: 'selected',
          }
        : state;

    case 'selectionCancelled':
      return state.stage === 'selecting'
        ? restoreSelectionFallback(state)
        : state;

    default:
      return null;
  }
}

function reduceUploadAction(
  state: MediaPostPublishingState,
  action: MediaPostPublishingAction,
): MediaPostPublishingState | null {
  switch (action.type) {
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

    default:
      return null;
  }
}

function reduceSubmissionAction(
  state: MediaPostPublishingState,
  action: MediaPostPublishingAction,
): MediaPostPublishingState | null {
  switch (action.type) {
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

    default:
      return null;
  }
}

function reduceWorkflowAction(
  state: MediaPostPublishingState,
  action: MediaPostPublishingAction,
): MediaPostPublishingState {
  switch (action.type) {
    case 'workflowFailed':
      if (state.stage === 'selecting' && state.selectionFallback) {
        return {
          ...state.selectionFallback,
          attemptId: state.attemptId,
          errorMessage: action.message,
          selectionFallback: null,
        };
      }

      return canFailWorkflow(state)
        ? {
            ...state,
            errorMessage: action.message,
            mediaAssetId: action.discardUpload ? null : state.mediaAssetId,
            stage: 'failed',
            uploadConfirmed: action.discardUpload
              ? false
              : state.uploadConfirmed,
          }
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

    default:
      return state;
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
  return state.stage !== 'idle';
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

function selectionFallbackFor(
  state: MediaPostPublishingState,
): MediaPostSelectionFallback | null {
  if (state.selection === null) {
    return null;
  }

  return {
    errorMessage: state.errorMessage,
    mediaAssetId: state.mediaAssetId,
    selection: state.selection,
    stage: state.stage,
    uploadConfirmed: state.uploadConfirmed,
  };
}

function restoreSelectionFallback(
  state: MediaPostPublishingState,
): MediaPostPublishingState {
  if (state.selectionFallback === null) {
    return resetStateAfter(state);
  }

  return {
    ...state.selectionFallback,
    attemptId: state.attemptId + 1,
    selectionFallback: null,
  };
}
