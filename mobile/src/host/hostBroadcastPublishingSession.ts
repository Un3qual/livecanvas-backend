import type {
  HostBroadcastPublishingChannelTerminationReason,
  HostBroadcastPublishingRuntime,
} from './hostBroadcastPublishingRuntime';

export type HostBroadcastPublishingResource = {
  readonly disconnectSocket: () => void;
  readonly runtime: HostBroadcastPublishingRuntime;
};

export type HostBroadcastPublishingRetainedEntry = {
  readonly liveSessionId: string;
  readonly resource: HostBroadcastPublishingResource;
};

export type HostBroadcastPublishingSessionStore = {
  readonly has: (liveSessionId: string) => boolean;
  readonly markAuthLossEndFailed: (
    liveSessionId: string,
    resource: HostBroadcastPublishingResource,
  ) => void;
  readonly releaseAllForAuthStateChange: () => readonly string[];
  readonly release: (liveSessionId: string) => void;
  readonly releaseAll: () => readonly string[];
  readonly releaseIfCurrent: (
    liveSessionId: string,
    resource: HostBroadcastPublishingResource,
  ) => boolean;
  readonly retain: (
    liveSessionId: string,
    resource: HostBroadcastPublishingResource,
  ) => void;
  readonly retainedEntries: () => readonly HostBroadcastPublishingRetainedEntry[];
};

export type HostBroadcastPublishingAuthStatus =
  | 'authenticated'
  | 'loading'
  | 'unauthenticated';

export type ReleaseHostBroadcastPublishingBeforeAuthLossOptions = {
  readonly apiBaseUrl: string;
  readonly fetchImpl?: typeof fetch;
  readonly getAccessToken: () => string | null;
  readonly store: Pick<
    HostBroadcastPublishingSessionStore,
    'markAuthLossEndFailed' | 'releaseIfCurrent' | 'retainedEntries'
  >;
};

const END_RETAINED_HOST_PUBLISHING_SESSION_MUTATION = `
  mutation HostBroadcastPublishingSessionAuthCleanupEndMutation($input: EndLiveSessionInput!) {
    endLiveSession(input: $input) {
      liveSession {
        id
      }
      errors {
        field
        message
      }
    }
  }
`;

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
  const failedAuthLossEndResources =
    new Map<string, HostBroadcastPublishingResource>();

  return {
    has(liveSessionId) {
      return resources.has(liveSessionId);
    },
    markAuthLossEndFailed(liveSessionId, resource) {
      if (resources.get(liveSessionId) === resource) {
        failedAuthLossEndResources.set(liveSessionId, resource);
      }
    },
    releaseAllForAuthStateChange() {
      const releasedLiveSessionIds: string[] = [];

      for (const [liveSessionId, resource] of resources) {
        if (failedAuthLossEndResources.get(liveSessionId) === resource) {
          continue;
        }

        resources.delete(liveSessionId);
        failedAuthLossEndResources.delete(liveSessionId);
        disposeHostBroadcastPublishingResource(resource);
        releasedLiveSessionIds.push(liveSessionId);
      }

      return releasedLiveSessionIds;
    },
    release(liveSessionId) {
      const resource = resources.get(liveSessionId);

      if (!resource) {
        return;
      }

      resources.delete(liveSessionId);
      failedAuthLossEndResources.delete(liveSessionId);
      disposeHostBroadcastPublishingResource(resource);
    },
    releaseAll() {
      const releasedLiveSessionIds = [...resources.keys()];
      const retainedResources = [...resources.values()];
      resources.clear();
      failedAuthLossEndResources.clear();

      for (const resource of retainedResources) {
        disposeHostBroadcastPublishingResource(resource);
      }

      return releasedLiveSessionIds;
    },
    releaseIfCurrent(liveSessionId, resource) {
      if (resources.get(liveSessionId) !== resource) {
        return false;
      }

      resources.delete(liveSessionId);
      failedAuthLossEndResources.delete(liveSessionId);
      disposeHostBroadcastPublishingResource(resource);
      return true;
    },
    retain(liveSessionId, resource) {
      const existing = resources.get(liveSessionId);

      if (existing === resource) {
        return;
      }

      failedAuthLossEndResources.delete(liveSessionId);

      if (existing) {
        disposeHostBroadcastPublishingResource(existing);
      }

      resources.set(liveSessionId, resource);
    },
    retainedEntries() {
      return [...resources].map(([liveSessionId, resource]) => ({
        liveSessionId,
        resource,
      }));
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
  store: Pick<HostBroadcastPublishingSessionStore, 'releaseAllForAuthStateChange'>,
): readonly string[] {
  if (previousStatus === 'authenticated' && nextStatus !== 'authenticated') {
    return store.releaseAllForAuthStateChange();
  }

  return [];
}

export async function releaseHostBroadcastPublishingBeforeAuthLoss({
  apiBaseUrl,
  fetchImpl = fetch,
  getAccessToken,
  store,
}: ReleaseHostBroadcastPublishingBeforeAuthLossOptions): Promise<
  readonly string[]
> {
  const accessToken = getAccessToken();
  const retainedEntries = store.retainedEntries();

  if (!accessToken) {
    for (const { liveSessionId, resource } of retainedEntries) {
      store.markAuthLossEndFailed(liveSessionId, resource);
    }

    return [];
  }

  const releasedLiveSessionIds = await Promise.all(
    retainedEntries.map(async ({ liveSessionId, resource }) => {
      if (
        await endRetainedHostPublishingLiveSession({
          accessToken,
          apiBaseUrl,
          fetchImpl,
          liveSessionId,
        })
      ) {
        return store.releaseIfCurrent(liveSessionId, resource)
          ? liveSessionId
          : null;
      }

      store.markAuthLossEndFailed(liveSessionId, resource);
      return null;
    }),
  );

  return releasedLiveSessionIds.filter(
    (liveSessionId): liveSessionId is string => liveSessionId !== null,
  );
}

async function endRetainedHostPublishingLiveSession({
  accessToken,
  apiBaseUrl,
  fetchImpl,
  liveSessionId,
}: {
  readonly accessToken: string;
  readonly apiBaseUrl: string;
  readonly fetchImpl: typeof fetch;
  readonly liveSessionId: string;
}): Promise<boolean> {
  let response: Response;

  try {
    response = await fetchImpl(`${apiBaseUrl}/graphql`, {
      body: JSON.stringify({
        query: END_RETAINED_HOST_PUBLISHING_SESSION_MUTATION,
        variables: {
          input: { liveSessionId },
        },
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
  } catch {
    return false;
  }

  if (!response.ok) {
    return false;
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    return false;
  }

  return isSuccessfulEndLiveSessionResponse(body);
}

function isSuccessfulEndLiveSessionResponse(body: unknown): boolean {
  if (!isObject(body) || hasEntries(body.errors)) {
    return false;
  }

  const data = body.data;
  if (!isObject(data)) {
    return false;
  }

  const payload = data.endLiveSession;
  if (!isObject(payload) || hasEntries(payload.errors)) {
    return false;
  }

  return isObject(payload.liveSession);
}

function hasEntries(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
