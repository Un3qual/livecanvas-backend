import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

import { useAuth } from '../auth/AuthProvider';
import {
  canAttachSelectedMedia,
  createMediaPostPublishingState,
  mediaPostPublishingReducer,
  type MediaPostPublishingAction,
  type MediaPostPublishingState,
} from './mediaPostPublishingState';
import {
  MediaPostSelectionError,
  type PickedPostMedia,
} from './mediaPostSelection';
import {
  MediaPostUploadError,
  pollMediaAssetUntilTerminal,
  type MediaAssetPollResult,
  type SignedMediaUpload,
} from './mediaPostUploadClient';
import { formatCreatePostMutationErrors } from './postComposerState';

export type MediaPostCreateInput = {
  readonly bodyText?: string;
  readonly kind: 'STANDARD' | 'STORY';
  readonly visibility: 'FOLLOWERS' | 'PUBLIC';
};

export type MediaPostPublishingDependencies = {
  readonly createPost: (args: {
    input: MediaPostCreateInput & { readonly mediaAssetIds: readonly [string] };
    signal: AbortSignal;
  }) => Promise<{
    readonly errors: ReadonlyArray<{
      readonly field?: string | null;
      readonly message: string;
    }>;
    readonly postId: string | null;
  }>;
  readonly delay: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  readonly fetchAsset: (args: {
    mediaAssetId: string;
    signal: AbortSignal;
  }) => Promise<MediaAssetPollResult | null>;
  readonly finalizeUpload: (args: {
    mediaAssetId: string;
    signal: AbortSignal;
  }) => Promise<MediaAssetPollResult>;
  readonly pickMedia: () => Promise<PickedPostMedia | null>;
  readonly requestUpload: (args: {
    mimeType: string;
    signal: AbortSignal;
  }) => Promise<{
    readonly mediaAssetId: string;
    readonly signedUpload: SignedMediaUpload;
  }>;
  readonly upload: (args: {
    selection: PickedPostMedia;
    signal: AbortSignal;
    signedUpload: SignedMediaUpload;
  }) => Promise<void>;
};

export type MediaPostPublishingController = {
  readonly cancel: () => void;
  readonly removeMedia: () => void;
  readonly retryMedia: () => void;
  readonly selectMedia: () => void;
  readonly state: MediaPostPublishingState;
  readonly submit: (input: MediaPostCreateInput) => void;
};

export function useMediaPostPublishing({
  dependencies,
}: {
  readonly dependencies: MediaPostPublishingDependencies;
}): MediaPostPublishingController {
  const {
    registerBeforeUnauthenticated,
    state: { status: authStatus },
  } = useAuth();
  const isMountedRef = useRef(true);
  const activeControllerRef = useRef<AbortController | null>(null);
  const [state, dispatch] = useReducer(
    mediaPostPublishingReducer,
    undefined,
    createMediaPostPublishingState,
  );
  const stateRef = useRef(state);

  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  const send = useCallback((action: MediaPostPublishingAction) => {
    const nextState = mediaPostPublishingReducer(stateRef.current, action);

    if (nextState !== stateRef.current) {
      stateRef.current = nextState;
      dispatch(action);
    }

    return nextState;
  }, []);

  const abortActive = useCallback(
    (action: 'cancelRequested' | 'removeRequested') => {
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;

      if (isMountedRef.current) {
        send({ type: action });
      }
    },
    [send],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
    };
  }, []);

  useEffect(
    () =>
      registerBeforeUnauthenticated(() => {
        abortActive('cancelRequested');
      }),
    [abortActive, registerBeforeUnauthenticated],
  );

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      abortActive('cancelRequested');
    }
  }, [abortActive, authStatus]);

  const isActiveAttempt = useCallback(
    (controller: AbortController, attemptId: number) =>
      isMountedRef.current &&
      activeControllerRef.current === controller &&
      !controller.signal.aborted &&
      stateRef.current.attemptId === attemptId,
    [],
  );

  const finishReady = useCallback(
    (controller: AbortController, attemptId: number) => {
      if (!isActiveAttempt(controller, attemptId)) {
        return;
      }

      send({ attemptId, type: 'processingSucceeded' });
      activeControllerRef.current = null;
    },
    [isActiveAttempt, send],
  );

  const failWorkflow = useCallback(
    (controller: AbortController, attemptId: number, error: unknown) => {
      if (!isActiveAttempt(controller, attemptId) || isAbortError(error)) {
        return;
      }

      send({
        attemptId,
        discardUpload: shouldDiscardUpload(error),
        message: formatMediaPublishingError(error),
        type: 'workflowFailed',
      });
      activeControllerRef.current = null;
    },
    [isActiveAttempt, send],
  );

  const finalizeAndPoll = useCallback(
    async (
      mediaAssetId: string,
      controller: AbortController,
      attemptId: number,
    ) => {
      try {
        for (let finalizeAttempt = 1; finalizeAttempt <= 60; finalizeAttempt += 1) {
          if (!isActiveAttempt(controller, attemptId)) {
            return;
          }

          let mediaAsset: MediaAssetPollResult;

          try {
            mediaAsset = await dependencies.finalizeUpload({
              mediaAssetId,
              signal: controller.signal,
            });
          } catch (finalizeError) {
            if (isAbortError(finalizeError) || controller.signal.aborted) {
              return;
            }

            if (shouldDiscardUpload(finalizeError)) {
              throw finalizeError;
            }

            const readback = await dependencies.fetchAsset({
              mediaAssetId,
              signal: controller.signal,
            });

            if (readback === null) {
              throw new MediaPostUploadError(
                'asset_missing',
                'This media is no longer available.',
              );
            }

            mediaAsset = readback;
          }

          if (mediaAsset.processingState === 'PROCESSED') {
            finishReady(controller, attemptId);
            return;
          }

          if (mediaAsset.processingState === 'FAILED') {
            throw new MediaPostUploadError(
              'processing_failed',
              'This media could not be processed.',
            );
          }

          if (mediaAsset.processingState === 'UPLOADED') {
            await pollMediaAssetUntilTerminal({
              assetId: mediaAssetId,
              delay: dependencies.delay,
              fetchAsset: (assetId, signal) =>
                dependencies.fetchAsset({ mediaAssetId: assetId, signal }),
              signal: controller.signal,
            });
            finishReady(controller, attemptId);
            return;
          }

          if (finalizeAttempt < 60) {
            await dependencies.delay(1000, controller.signal);
          }
        }

        throw new MediaPostUploadError(
          'processing_timeout',
          'Media processing is taking longer than expected. Try again.',
        );
      } catch (error) {
        failWorkflow(controller, attemptId, error);
      }
    },
    [dependencies, failWorkflow, finishReady, isActiveAttempt],
  );

  const requestUploadAndProcess = useCallback(
    async (
      selection: PickedPostMedia,
      controller: AbortController,
      attemptId: number,
    ) => {
      try {
        const request = await dependencies.requestUpload({
          mimeType: selection.mimeType,
          signal: controller.signal,
        });

        if (!isActiveAttempt(controller, attemptId)) {
          return;
        }

        send({
          attemptId,
          mediaAssetId: request.mediaAssetId,
          type: 'uploadIntentReceived',
        });

        await dependencies.upload({
          selection,
          signal: controller.signal,
          signedUpload: request.signedUpload,
        });

        if (!isActiveAttempt(controller, attemptId)) {
          return;
        }

        send({ attemptId, type: 'uploadConfirmed' });
        await finalizeAndPoll(request.mediaAssetId, controller, attemptId);
      } catch (error) {
        failWorkflow(controller, attemptId, error);
      }
    },
    [dependencies, failWorkflow, finalizeAndPoll, isActiveAttempt, send],
  );

  const selectMedia = useCallback(() => {
    if (!canSelectFrom(stateRef.current) || activeControllerRef.current) {
      return;
    }

    const selectingState = send({ type: 'selectionStarted' });

    if (selectingState.stage !== 'selecting') {
      return;
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;
    const selectionAttemptId = selectingState.attemptId;

    observePromise(
      dependencies.pickMedia().then((selection) => {
        if (!isActiveAttempt(controller, selectionAttemptId)) {
          return;
        }

        if (selection === null) {
          send({
            attemptId: selectionAttemptId,
            type: 'selectionCancelled',
          });
          activeControllerRef.current = null;
          return;
        }

        send({
          attemptId: selectionAttemptId,
          selection,
          type: 'selectionSucceeded',
        });
        const requestingState = send({ type: 'uploadRequested' });

        if (requestingState.stage !== 'requesting') {
          activeControllerRef.current = null;
          return;
        }

        observePromise(
          requestUploadAndProcess(
            selection,
            controller,
            requestingState.attemptId,
          ),
        );
      }).catch((error) => {
          failWorkflow(controller, selectionAttemptId, error);
        }),
    );
  }, [dependencies, failWorkflow, isActiveAttempt, requestUploadAndProcess, send]);

  const retryMedia = useCallback(() => {
    if (stateRef.current.stage !== 'failed' || activeControllerRef.current) {
      return;
    }

    const retryState = send({ type: 'retryRequested' });
    const controller = new AbortController();
    activeControllerRef.current = controller;

    if (
      retryState.stage === 'processing' &&
      retryState.mediaAssetId !== null
    ) {
      observePromise(
        finalizeAndPoll(
          retryState.mediaAssetId,
          controller,
          retryState.attemptId,
        ),
      );
      return;
    }

    if (retryState.stage === 'requesting' && retryState.selection !== null) {
      observePromise(
        requestUploadAndProcess(
          retryState.selection,
          controller,
          retryState.attemptId,
        ),
      );
      return;
    }

    activeControllerRef.current = null;
  }, [finalizeAndPoll, requestUploadAndProcess, send]);

  const removeMedia = useCallback(() => {
    abortActive('removeRequested');
  }, [abortActive]);

  const cancel = useCallback(() => {
    abortActive('cancelRequested');
  }, [abortActive]);

  const submit = useCallback(
    (input: MediaPostCreateInput) => {
      const current = stateRef.current;

      if (!canAttachSelectedMedia(current) || activeControllerRef.current) {
        return;
      }

      const submittingState = send({ type: 'submissionStarted' });

      if (
        submittingState.stage !== 'submitting' ||
        submittingState.mediaAssetId === null
      ) {
        return;
      }

      const controller = new AbortController();
      activeControllerRef.current = controller;
      const attemptId = submittingState.attemptId;

      observePromise(
        dependencies.createPost({
          input: {
            ...input,
            mediaAssetIds: [submittingState.mediaAssetId],
          },
          signal: controller.signal,
        }).then((result) => {
          if (!isActiveAttempt(controller, attemptId)) {
            return;
          }

          activeControllerRef.current = null;

          if (result.postId === null || result.errors.length > 0) {
            send({
              attemptId,
              message: formatCreatePostMutationErrors(result.errors),
              type: 'submissionFailed',
            });
            return;
          }

          send({ attemptId, type: 'submissionSucceeded' });
        })
        .catch((error) => {
          if (!isActiveAttempt(controller, attemptId) || isAbortError(error)) {
            return;
          }

          activeControllerRef.current = null;
          send({
            attemptId,
            message: formatCreatePostMutationErrors(null),
            type: 'submissionFailed',
          });
        }),
      );
    },
    [dependencies, isActiveAttempt, send],
  );

  const actions = useMemo(
    () => ({ cancel, removeMedia, retryMedia, selectMedia, submit }),
    [cancel, removeMedia, retryMedia, selectMedia, submit],
  );

  return useMemo(
    () => ({ ...actions, state }),
    [actions, state],
  );
}

function canSelectFrom(state: MediaPostPublishingState): boolean {
  return ['idle', 'selected', 'ready', 'failed', 'cancelled', 'succeeded'].includes(
    state.stage,
  );
}

function formatMediaPublishingError(error: unknown): string {
  if (
    error instanceof MediaPostSelectionError ||
    error instanceof MediaPostUploadError
  ) {
    return error.message;
  }

  return 'We could not publish this media. Try again.';
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof MediaPostUploadError && error.code === 'aborted')
  );
}

function shouldDiscardUpload(error: unknown): boolean {
  return (
    error instanceof MediaPostUploadError &&
    ['asset_missing', 'processing_failed', 'upload_rejected'].includes(error.code)
  );
}

function observePromise(promise: Promise<unknown>): void {
  promise.catch(() => undefined);
}
