import { useMemo } from 'react';
import {
  fetchQuery,
  graphql,
  useMutation,
  useRelayEnvironment,
} from 'react-relay';

import type { postComposerOperationsCreatePostMutation as PostComposerCreatePostMutation } from '../__generated__/postComposerOperationsCreatePostMutation.graphql';
import type { postComposerOperationsFinalizeMediaUploadMutation as PostComposerFinalizeMediaUploadMutation } from '../__generated__/postComposerOperationsFinalizeMediaUploadMutation.graphql';
import type { postComposerOperationsMediaAssetQuery as PostComposerMediaAssetQuery } from '../__generated__/postComposerOperationsMediaAssetQuery.graphql';
import type { postComposerOperationsRequestMediaUploadMutation as PostComposerRequestMediaUploadMutation } from '../__generated__/postComposerOperationsRequestMediaUploadMutation.graphql';
import { pickPostMedia } from '../content/mediaPostSelection';
import {
  MediaPostUploadError,
  finalizeUploadPayloadError,
  normalizeMediaAssetProcessingState,
  uploadSignedMedia,
  type MediaAssetPollResult,
} from '../content/mediaPostUploadClient';
import type { MediaPostPublishingDependencies } from '../content/useMediaPostPublishing';

export type {
  PostComposerCreatePostMutation,
  PostComposerFinalizeMediaUploadMutation,
  PostComposerMediaAssetQuery,
  PostComposerRequestMediaUploadMutation,
};

export const postComposerRequestMediaUploadMutation = graphql`
  mutation postComposerOperationsRequestMediaUploadMutation(
    $input: RequestMediaUploadInput!
  ) {
    requestMediaUpload(input: $input) {
      mediaAsset {
        id
        mimeType
        processingState
      }
      signedUpload {
        method
        url
        expiresAt
        headers {
          name
          value
        }
      }
      errors {
        field
        message
      }
    }
  }
`;

export const postComposerFinalizeMediaUploadMutation = graphql`
  mutation postComposerOperationsFinalizeMediaUploadMutation(
    $input: FinalizeMediaUploadInput!
  ) {
    finalizeMediaUpload(input: $input) {
      mediaAsset {
        id
        processingState
      }
      errors {
        field
        message
      }
    }
  }
`;

export const postComposerMediaAssetQuery = graphql`
  query postComposerOperationsMediaAssetQuery($id: ID!) {
    mediaAsset(id: $id) {
      id
      processingState
    }
  }
`;

export const postComposerCreatePostMutation = graphql`
  mutation postComposerOperationsCreatePostMutation(
    $input: CreatePostInput!
  ) {
    createPost(input: $input) {
      post {
        id
        kind
        bodyText
        visibility
        expiresAt
        insertedAt
        author {
          id
          email
        }
        mediaAssets {
          id
          mimeType
          processingState
          publicUrl
        }
      }
      errors {
        field
        message
      }
    }
  }
`;

export function usePostComposerMediaPublishingDependencies(): MediaPostPublishingDependencies {
  const environment = useRelayEnvironment();
  const [commitRequestUpload] =
    useMutation<PostComposerRequestMediaUploadMutation>(
      postComposerRequestMediaUploadMutation,
    );
  const [commitFinalizeUpload] =
    useMutation<PostComposerFinalizeMediaUploadMutation>(
      postComposerFinalizeMediaUploadMutation,
    );
  const [commitCreatePost] = useMutation<PostComposerCreatePostMutation>(
    postComposerCreatePostMutation,
  );

  return useMemo(
    () => ({
      createPost: ({ input, signal }) =>
        relayMutationPromise<PostComposerCreatePostMutation['response']>(
          signal,
          (onCompleted, onError) =>
            commitCreatePost({
              onCompleted,
              onError,
              variables: { input },
            }),
        ).then((payload) => ({
          errors: payload.createPost?.errors ?? [],
          postId: payload.createPost?.post?.id ?? null,
        })),
      delay: defaultDelay,
      fetchAsset: ({ mediaAssetId, signal }) =>
        relayFetchAsset(environment, mediaAssetId, signal),
      finalizeUpload: ({ mediaAssetId, signal }) =>
        relayMutationPromise<PostComposerFinalizeMediaUploadMutation['response']>(
          signal,
          (onCompleted, onError) =>
            commitFinalizeUpload({
              onCompleted,
              onError,
              variables: { input: { mediaAssetId } },
            }),
        ).then((payload) => {
          const result = payload.finalizeMediaUpload;

          if (result?.errors.length) {
            throw finalizeUploadPayloadError(result.errors);
          }

          if (!result?.mediaAsset) {
            throw finalizeUploadPayloadError([]);
          }

          return {
            processingState: normalizeMediaAssetProcessingState(
              result.mediaAsset.processingState,
            ),
          };
        }),
      pickMedia: pickPostMedia,
      requestUpload: ({ mimeType, signal }) =>
        relayMutationPromise<PostComposerRequestMediaUploadMutation['response']>(
          signal,
          (onCompleted, onError) =>
            commitRequestUpload({
              onCompleted,
              onError,
              variables: { input: { mimeType } },
            }),
        ).then((payload) => {
          const result = payload.requestMediaUpload;
          const mediaAsset = result?.mediaAsset;
          const signedUpload = result?.signedUpload;

          if (
            !mediaAsset ||
            !signedUpload ||
            result.errors.length > 0 ||
            !isSignedUploadMethod(signedUpload.method)
          ) {
            throw new Error('Media upload preparation failed.');
          }

          return {
            mediaAssetId: mediaAsset.id,
            signedUpload: {
              headers: signedUpload.headers,
              method: signedUpload.method,
              url: signedUpload.url,
            },
          };
        }),
      upload: uploadSignedMedia,
    }),
    [
      commitCreatePost,
      commitFinalizeUpload,
      commitRequestUpload,
      environment,
    ],
  );
}

type RelayDisposable = { dispose: () => void };

function relayMutationPromise<T>(
  signal: AbortSignal,
  commit: (
    onCompleted: (payload: T) => void,
    onError: (error: Error) => void,
  ) => RelayDisposable,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortedError());
      return;
    }

    let disposable: RelayDisposable | null = null;
    const abort = () => {
      disposable?.dispose();
      signal.removeEventListener('abort', abort);
      reject(abortedError());
    };

    signal.addEventListener('abort', abort, { once: true });
    disposable = commit(
      (payload) => {
        signal.removeEventListener('abort', abort);
        resolve(payload);
      },
      (error) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );

    if (signal.aborted) {
      abort();
    }
  });
}

function relayFetchAsset(
  environment: ReturnType<typeof useRelayEnvironment>,
  mediaAssetId: string,
  signal: AbortSignal,
): Promise<MediaAssetPollResult | null> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortedError());
      return;
    }

    const observable = fetchQuery<PostComposerMediaAssetQuery>(
      environment,
      postComposerMediaAssetQuery,
      { id: mediaAssetId },
      { fetchPolicy: 'network-only' },
    );
    let subscription: { unsubscribe: () => void } | null = null;
    const abort = () => {
      subscription?.unsubscribe();
      reject(abortedError());
    };

    subscription = observable.subscribe({
      error: (error: Error) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
      next: (payload) => {
        signal.removeEventListener('abort', abort);
        subscription?.unsubscribe();
        resolve(
          payload.mediaAsset
            ? {
                processingState: normalizeMediaAssetProcessingState(
                  payload.mediaAsset.processingState,
                ),
              }
            : null,
        );
      },
    });

    signal.addEventListener('abort', abort, { once: true });
  });
}

function defaultDelay(
  milliseconds: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortedError());
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const abort = () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      reject(abortedError());
    };
    timeout = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
  });
}

function isSignedUploadMethod(method: string): method is 'PUT' | 'POST' {
  return method === 'PUT' || method === 'POST';
}

function abortedError(): MediaPostUploadError {
  return new MediaPostUploadError(
    'aborted',
    'Media publishing was cancelled.',
  );
}
