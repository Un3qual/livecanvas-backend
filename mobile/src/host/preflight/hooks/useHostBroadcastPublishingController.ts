import { useEffect, useMemo, type MutableRefObject } from 'react';

import type { AuthState } from '../../../auth/types';
import {
  createPhoenixSocket,
  type PhoenixAccessTokenProvider,
  type PhoenixSocket,
  type PhoenixSocketOptions,
} from '../../../realtime/phoenixSocket';
import type { HostBroadcastMediaPreparation } from '../../hostBroadcastMediaSignaling';
import type { HostBroadcastNative } from '../../hostBroadcastNative';
import {
  createDefaultHostBroadcastPeerConnectionFactory,
  createHostBroadcastPublishingRuntime,
  type HostBroadcastPublishingPeerConnectionFactory,
  type HostBroadcastPublishingRuntime,
  type HostBroadcastPublishingRuntimeOptions,
} from '../../publishing/hostBroadcastPublishingRuntime';
import {
  handleReleasedRetainedHostPublishingSessionTermination,
  releaseCurrentRetainedHostPublishingResource,
  shouldIgnoreRetainedHostPublishingChannelTermination,
  type HostBroadcastPublishingPreflightController,
  type HostBroadcastPublishingResource,
  type HostBroadcastPublishingSessionStore,
} from '../../publishing/hostBroadcastPublishingSessionStore';
import type { HostBroadcastPublishingStatus } from '../hostBroadcastPreflightScreenTypes';

const HOST_PUBLISHING_ERROR =
  'Could not start host media publishing. Please try again.';

type PublishingStatusSetter = (
  status: HostBroadcastPublishingStatus,
) => void;

export type HostBroadcastPublishingControllerSyncOptions = {
  readonly authStatus: AuthState['status'];
  readonly preparedMedia: HostBroadcastMediaPreparation | null;
};

export type HostBroadcastPublishingControllerLifecycle = {
  readonly hasRetainedPublishingResource: () => boolean;
  readonly retainAttachedPublishingForLiveSession: (
    liveSessionId: string,
  ) => HostBroadcastPublishingResource | null;
  readonly syncPublishing: (
    options: HostBroadcastPublishingControllerSyncOptions,
  ) => (() => void) | undefined;
};

export type HostBroadcastPublishingControllerLifecycleOptions = {
  readonly createPeerConnectionFactory?: () =>
    | HostBroadcastPublishingPeerConnectionFactory
    | null;
  readonly createPublishingRuntime?: (
    options: HostBroadcastPublishingRuntimeOptions,
  ) => HostBroadcastPublishingRuntime;
  readonly createSocket?: (options: PhoenixSocketOptions) => PhoenixSocket;
  readonly failPreparedPublishing: (reason: string) => void;
  readonly getAccessToken: PhoenixAccessTokenProvider;
  readonly hasRetainedPublishingResourceRef: MutableRefObject<boolean>;
  readonly hostPublishingSessions: HostBroadcastPublishingSessionStore;
  readonly native: Pick<
    HostBroadcastNative,
    'getPreviewStream' | 'releasePreviewStream'
  >;
  readonly publishingPreflightController: HostBroadcastPublishingPreflightController;
  readonly requestPreflightEndLiveSession: (liveSessionId: string) => void;
  readonly retainedPublishingLiveSessionIdsRef: MutableRefObject<
    Map<HostBroadcastPublishingResource, string>
  >;
  readonly retainedPublishingResourceRef: MutableRefObject<HostBroadcastPublishingResource | null>;
  readonly setBackendMediaContractReady: (ready: boolean) => void;
  readonly setHostActionError: (error: string | null) => void;
  readonly setIdlePublishingStatusUnlessErrored?: () => void;
  readonly setPublishingStatus: PublishingStatusSetter;
  readonly websocketUrl: string;
};

export type HostBroadcastPublishingControllerOptions =
  HostBroadcastPublishingControllerLifecycleOptions &
    HostBroadcastPublishingControllerSyncOptions;

export type HostBroadcastPublishingController = {
  readonly hasRetainedPublishingResource: () => boolean;
  readonly retainAttachedPublishingForLiveSession: (
    liveSessionId: string,
  ) => HostBroadcastPublishingResource | null;
};

export function createHostBroadcastPublishingControllerLifecycle({
  createPeerConnectionFactory = createDefaultHostBroadcastPeerConnectionFactory,
  createPublishingRuntime = createHostBroadcastPublishingRuntime,
  createSocket = createPhoenixSocket,
  failPreparedPublishing,
  getAccessToken,
  hasRetainedPublishingResourceRef,
  hostPublishingSessions,
  native,
  publishingPreflightController,
  requestPreflightEndLiveSession,
  retainedPublishingLiveSessionIdsRef,
  retainedPublishingResourceRef,
  setBackendMediaContractReady,
  setHostActionError,
  setIdlePublishingStatusUnlessErrored,
  setPublishingStatus,
  websocketUrl,
}: HostBroadcastPublishingControllerLifecycleOptions): HostBroadcastPublishingControllerLifecycle {
  function syncPublishing({
    authStatus,
    preparedMedia,
  }: HostBroadcastPublishingControllerSyncOptions) {
    if (!preparedMedia) {
      setIdlePublishingStatusUnlessErrored?.();
      return undefined;
    }

    if (authStatus !== 'authenticated') {
      failPreparedPublishing(HOST_PUBLISHING_ERROR);
      return undefined;
    }

    const mediaPreparation = preparedMedia;
    let isActive = true;
    let runtime: HostBroadcastPublishingRuntime | null = null;
    let publishingResource: HostBroadcastPublishingResource | null = null;
    let didHandleChannelTermination = false;
    const socket = createSocket({
      getAccessToken,
      websocketUrl,
    });
    const peerConnectionFactory = createPeerConnectionFactory();

    setBackendMediaContractReady(false);
    setPublishingStatus('starting');
    setHostActionError(null);

    function releaseRetainedPublishingResource() {
      return releaseCurrentRetainedHostPublishingResource({
        clearCurrentResource: (resource) => {
          if (retainedPublishingResourceRef.current === resource) {
            retainedPublishingResourceRef.current = null;
            hasRetainedPublishingResourceRef.current = false;
          }
        },
        currentResource: publishingResource,
        liveSessionIdsByResource: retainedPublishingLiveSessionIdsRef.current,
        store: hostPublishingSessions,
      });
    }

    function currentRetainedPublishingLiveSessionId() {
      return publishingResource
        ? (retainedPublishingLiveSessionIdsRef.current.get(
            publishingResource,
          ) ?? null)
        : null;
    }

    async function startPublishingRuntime() {
      const localStream = await native.getPreviewStream();

      if (!isActive) {
        return;
      }

      if (!localStream || !peerConnectionFactory) {
        failPreparedPublishing(HOST_PUBLISHING_ERROR);
        return;
      }

      runtime = createPublishingRuntime({
        disposeLocalMedia: native.releasePreviewStream,
        localStream,
        onChannelTerminated: (reason) => {
          if (didHandleChannelTermination) {
            return;
          }

          if (
            shouldIgnoreRetainedHostPublishingChannelTermination(
              reason,
              currentRetainedPublishingLiveSessionId(),
            )
          ) {
            return;
          }

          didHandleChannelTermination = true;

          if (
            handleReleasedRetainedHostPublishingSessionTermination(
              reason,
              releaseRetainedPublishingResource(),
              requestPreflightEndLiveSession,
            )
          ) {
            return;
          }

          if (!isActive) {
            return;
          }

          failPreparedPublishing(HOST_PUBLISHING_ERROR);
        },
        onError: (reason) => {
          const retainedLiveSessionId = releaseRetainedPublishingResource();
          if (retainedLiveSessionId) {
            requestPreflightEndLiveSession(retainedLiveSessionId);
            return;
          }

          if (!isActive) {
            return;
          }

          failPreparedPublishing(reason);
        },
        onNegotiationReady: () => {
          if (!isActive) {
            return;
          }

          setPublishingStatus('ready');
          setBackendMediaContractReady(true);
          setHostActionError(null);
        },
        onNegotiationPending: () => {
          if (!isActive) {
            return;
          }

          setPublishingStatus('negotiating');
          setBackendMediaContractReady(false);
        },
        peerConnectionFactory,
        preparedMedia: mediaPreparation,
        socket,
      });
      publishingResource = {
        disconnectSocket: () => {
          socket.disconnect();
        },
        runtime,
      };
      publishingPreflightController.attachResource(publishingResource);
      socket.connect();

      const result = await runtime.start();

      if (!isActive) {
        return;
      }

      if (result.status === 'error') {
        failPreparedPublishing(result.reason);
        return;
      }

      setPublishingStatus(
        runtime.isNegotiationReady() ? 'ready' : 'negotiating',
      );
    }

    startPublishingRuntime().catch(() => {
      if (!isActive) {
        return;
      }

      failPreparedPublishing(HOST_PUBLISHING_ERROR);
    });

    return () => {
      isActive = false;
      publishingPreflightController.cleanupAttachedResource();
    };
  }

  function retainAttachedPublishingForLiveSession(
    liveSessionId: string,
  ): HostBroadcastPublishingResource | null {
    const retainedResource =
      publishingPreflightController.retainForLiveSession(
        liveSessionId,
        hostPublishingSessions,
      );

    if (!retainedResource) {
      return null;
    }

    hasRetainedPublishingResourceRef.current = true;
    retainedPublishingResourceRef.current = retainedResource;
    retainedPublishingLiveSessionIdsRef.current.set(
      retainedResource,
      liveSessionId,
    );
    return retainedResource;
  }

  return {
    hasRetainedPublishingResource() {
      return hasRetainedPublishingResourceRef.current;
    },
    retainAttachedPublishingForLiveSession,
    syncPublishing,
  };
}

export function useHostBroadcastPublishingController({
  authStatus,
  createPeerConnectionFactory,
  createPublishingRuntime,
  createSocket,
  failPreparedPublishing,
  getAccessToken,
  hasRetainedPublishingResourceRef,
  hostPublishingSessions,
  native,
  preparedMedia,
  publishingPreflightController,
  requestPreflightEndLiveSession,
  retainedPublishingLiveSessionIdsRef,
  retainedPublishingResourceRef,
  setBackendMediaContractReady,
  setHostActionError,
  setIdlePublishingStatusUnlessErrored,
  setPublishingStatus,
  websocketUrl,
}: HostBroadcastPublishingControllerOptions): HostBroadcastPublishingController {
  const lifecycle = useMemo(
    () =>
      createHostBroadcastPublishingControllerLifecycle({
        createPeerConnectionFactory,
        createPublishingRuntime,
        createSocket,
        failPreparedPublishing,
        getAccessToken,
        hasRetainedPublishingResourceRef,
        hostPublishingSessions,
        native,
        publishingPreflightController,
        requestPreflightEndLiveSession,
        retainedPublishingLiveSessionIdsRef,
        retainedPublishingResourceRef,
        setBackendMediaContractReady,
        setHostActionError,
        setIdlePublishingStatusUnlessErrored,
        setPublishingStatus,
        websocketUrl,
      }),
    [
      createPeerConnectionFactory,
      createPublishingRuntime,
      createSocket,
      failPreparedPublishing,
      getAccessToken,
      hasRetainedPublishingResourceRef,
      hostPublishingSessions,
      native,
      publishingPreflightController,
      requestPreflightEndLiveSession,
      retainedPublishingLiveSessionIdsRef,
      retainedPublishingResourceRef,
      setBackendMediaContractReady,
      setHostActionError,
      setIdlePublishingStatusUnlessErrored,
      setPublishingStatus,
      websocketUrl,
    ],
  );

  useEffect(
    () =>
      lifecycle.syncPublishing({
        authStatus,
        preparedMedia,
      }),
    [authStatus, lifecycle, preparedMedia],
  );

  return {
    hasRetainedPublishingResource: lifecycle.hasRetainedPublishingResource,
    retainAttachedPublishingForLiveSession:
      lifecycle.retainAttachedPublishingForLiveSession,
  };
}
