import type {
  HostBroadcastPublishingChannelTerminationReason,
  HostBroadcastPublishingRuntime,
} from './hostBroadcastPublishingRuntime';

export type HostBroadcastPublishingResource = {
  readonly disconnectSocket: () => void;
  readonly runtime: HostBroadcastPublishingRuntime;
};

export type HostBroadcastPublishingSessionStore = {
  readonly has: (liveSessionId: string) => boolean;
  readonly release: (liveSessionId: string) => void;
  readonly releaseAll: () => void;
  readonly releaseIfCurrent: (
    liveSessionId: string,
    resource: HostBroadcastPublishingResource,
  ) => boolean;
  readonly retain: (
    liveSessionId: string,
    resource: HostBroadcastPublishingResource,
  ) => void;
};

export type HostBroadcastPublishingAuthStatus =
  | 'authenticated'
  | 'loading'
  | 'unauthenticated';

export type ReleaseCurrentRetainedHostPublishingResourceOptions = {
  readonly clearCurrentResource: (
    resource: HostBroadcastPublishingResource,
  ) => void;
  readonly currentResource: HostBroadcastPublishingResource | null;
  readonly liveSessionIdsByResource: Map<HostBroadcastPublishingResource, string>;
  readonly store: HostBroadcastPublishingSessionStore;
};

export type HostBroadcastPublishingPreflightController = {
  readonly attachResource: (resource: HostBroadcastPublishingResource) => void;
  readonly cleanupAttachedResource: () => void;
  readonly retainForLiveSession: (
    liveSessionId: string,
    store: HostBroadcastPublishingSessionStore,
  ) => HostBroadcastPublishingResource | null;
};

const disposedResources = new WeakSet<HostBroadcastPublishingResource>();

export function createHostBroadcastPublishingSessionStore(): HostBroadcastPublishingSessionStore {
  const resources = new Map<string, HostBroadcastPublishingResource>();

  return {
    has(liveSessionId) {
      return resources.has(liveSessionId);
    },
    release(liveSessionId) {
      const resource = resources.get(liveSessionId);

      if (!resource) {
        return;
      }

      resources.delete(liveSessionId);
      disposeHostBroadcastPublishingResource(resource);
    },
    releaseAll() {
      const retainedResources = [...resources.values()];
      resources.clear();

      for (const resource of retainedResources) {
        disposeHostBroadcastPublishingResource(resource);
      }
    },
    releaseIfCurrent(liveSessionId, resource) {
      if (resources.get(liveSessionId) !== resource) {
        return false;
      }

      resources.delete(liveSessionId);
      disposeHostBroadcastPublishingResource(resource);
      return true;
    },
    retain(liveSessionId, resource) {
      const existing = resources.get(liveSessionId);

      if (existing === resource) {
        return;
      }

      if (existing) {
        disposeHostBroadcastPublishingResource(existing);
      }

      resources.set(liveSessionId, resource);
    },
  };
}

export function createHostBroadcastPublishingPreflightController(): HostBroadcastPublishingPreflightController {
  let attachedResource: HostBroadcastPublishingResource | null = null;

  return {
    attachResource(resource) {
      if (attachedResource && attachedResource !== resource) {
        disposeHostBroadcastPublishingResource(attachedResource);
      }

      attachedResource = resource;
    },
    cleanupAttachedResource() {
      if (!attachedResource) {
        return;
      }

      const resource = attachedResource;
      attachedResource = null;
      disposeHostBroadcastPublishingResource(resource);
    },
    retainForLiveSession(liveSessionId, store) {
      if (!attachedResource) {
        return null;
      }

      const resource = attachedResource;
      attachedResource = null;
      store.retain(liveSessionId, resource);
      return resource;
    },
  };
}

export function disposeHostBroadcastPublishingResource(
  resource: HostBroadcastPublishingResource,
): void {
  if (disposedResources.has(resource)) {
    return;
  }

  disposedResources.add(resource);
  resource.runtime.dispose();
  resource.disconnectSocket();
}

export function releaseHostBroadcastPublishingRetainedResource(
  liveSessionId: string,
  resource: HostBroadcastPublishingResource,
  store: HostBroadcastPublishingSessionStore,
): boolean {
  return store.releaseIfCurrent(liveSessionId, resource);
}

export function releaseCurrentRetainedHostPublishingResource({
  clearCurrentResource,
  currentResource,
  liveSessionIdsByResource,
  store,
}: ReleaseCurrentRetainedHostPublishingResourceOptions): string | null {
  const liveSessionId = currentResource
    ? liveSessionIdsByResource.get(currentResource)
    : null;

  if (!currentResource || !liveSessionId) {
    return null;
  }

  if (
    !releaseHostBroadcastPublishingRetainedResource(
      liveSessionId,
      currentResource,
      store,
    )
  ) {
    return null;
  }

  liveSessionIdsByResource.delete(currentResource);
  clearCurrentResource(currentResource);
  return liveSessionId;
}

export function handleReleasedRetainedHostPublishingSessionTermination(
  reason: HostBroadcastPublishingChannelTerminationReason,
  liveSessionId: string | null,
  endLiveSession: (liveSessionId: string) => void,
): boolean {
  if (!liveSessionId) {
    return false;
  }

  if (reason === 'closed') {
    endLiveSession(liveSessionId);
  }

  return true;
}

export function shouldIgnoreRetainedHostPublishingChannelTermination(
  reason: HostBroadcastPublishingChannelTerminationReason,
  retainedLiveSessionId: string | null,
): boolean {
  return reason === 'errored' && retainedLiveSessionId !== null;
}

export function releaseHostBroadcastPublishingAfterAuthStateChange(
  previousStatus: HostBroadcastPublishingAuthStatus,
  nextStatus: HostBroadcastPublishingAuthStatus,
  store: Pick<HostBroadcastPublishingSessionStore, 'releaseAll'>,
): void {
  if (previousStatus === 'authenticated' && nextStatus !== 'authenticated') {
    store.releaseAll();
  }
}
