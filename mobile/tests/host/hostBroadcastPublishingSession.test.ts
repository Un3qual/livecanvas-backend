import { describe, expect, test } from 'bun:test';

import {
  releaseHostBroadcastPublishingAfterAuthStateChange,
  releaseHostBroadcastPublishingBeforeAuthLoss,
} from '../../src/host/publishing/hostBroadcastPublishingAuthCleanup';
import type { HostBroadcastLocalMediaControls } from '../../src/host/publishing/hostBroadcastLocalMediaControls';
import {
  createHostBroadcastPublishingPreflightController,
  createHostBroadcastPublishingSessionStore,
  handleReleasedRetainedHostPublishingSessionTermination,
  releaseCurrentRetainedHostPublishingResource,
  releaseHostBroadcastPublishingRetainedResource,
  shouldIgnoreRetainedHostPublishingChannelTermination,
  type HostBroadcastPublishingResource,
} from '../../src/host/publishing/hostBroadcastPublishingSessionStore';

function createResource(
  localMediaControls?: HostBroadcastLocalMediaControls,
): HostBroadcastPublishingResource & {
  readonly disconnectCount: () => number;
  readonly disposeCount: () => number;
} {
  let disconnectCount = 0;
  let disposeCount = 0;

  return {
    disconnectCount: () => disconnectCount,
    disconnectSocket() {
      disconnectCount += 1;
    },
    disposeCount: () => disposeCount,
    runtime: {
      dispose() {
        disposeCount += 1;
      },
      isNegotiationReady() {
        return true;
      },
      start() {
        return Promise.resolve({ status: 'started' as const });
      },
    },
    ...(localMediaControls ? { localMediaControls } : {}),
  };
}

function createLocalMediaControls(): HostBroadcastLocalMediaControls {
  return {
    setAudioEnabled() {
      // Store tests only need object identity for retained controls.
    },
    setVideoEnabled() {
      // Store tests only need object identity for retained controls.
    },
    snapshot() {
      return {
        audio: { available: true, enabled: true },
        video: { available: true, enabled: true },
      };
    },
  };
}

function createDeferredResponse(): {
  readonly promise: Promise<Response>;
  readonly resolve: (response: Response) => void;
} {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe('hostBroadcastPublishingSession', () => {
  test('retains successful go-live publishing resources across preflight cleanup', () => {
    const store = createHostBroadcastPublishingSessionStore();
    const controller = createHostBroadcastPublishingPreflightController();
    const resource = createResource();

    controller.attachResource(resource);
    expect(controller.retainForLiveSession('live-session-id', store)).toBe(
      resource,
    );
    controller.cleanupAttachedResource();

    expect(resource.disposeCount()).toBe(0);
    expect(resource.disconnectCount()).toBe(0);
    expect(store.has('live-session-id')).toBe(true);

    store.release('live-session-id');

    expect(resource.disposeCount()).toBe(1);
    expect(resource.disconnectCount()).toBe(1);
    expect(store.has('live-session-id')).toBe(false);
  });

  test('disposes unretained preflight publishing resources during cleanup', () => {
    const controller = createHostBroadcastPublishingPreflightController();
    const resource = createResource();

    controller.attachResource(resource);
    controller.cleanupAttachedResource();
    controller.cleanupAttachedResource();

    expect(resource.disposeCount()).toBe(1);
    expect(resource.disconnectCount()).toBe(1);
  });

  test('reports no retained session when publishing setup never attached a resource', () => {
    const store = createHostBroadcastPublishingSessionStore();
    const controller = createHostBroadcastPublishingPreflightController();

    expect(controller.retainForLiveSession('live-session-id', store)).toBeNull();
    expect(store.has('live-session-id')).toBe(false);
  });

  test('reports no retained session after preflight cleanup has disposed the attached resource', () => {
    const store = createHostBroadcastPublishingSessionStore();
    const controller = createHostBroadcastPublishingPreflightController();
    const resource = createResource();

    controller.attachResource(resource);
    controller.cleanupAttachedResource();

    expect(controller.retainForLiveSession('live-session-id', store)).toBeNull();
    expect(store.has('live-session-id')).toBe(false);
    expect(resource.disposeCount()).toBe(1);
    expect(resource.disconnectCount()).toBe(1);
  });

  test('returns controls for the current retained publishing resource', () => {
    const store = createHostBroadcastPublishingSessionStore();
    const controls = createLocalMediaControls();
    const resource = createResource(controls);

    expect(store.controlsFor('live-session-id')).toBeNull();

    store.retain('live-session-id', resource);

    expect(store.controlsFor('live-session-id')).toBe(controls);
  });

  test('does not require retained publishing resources to carry local controls', () => {
    const store = createHostBroadcastPublishingSessionStore();
    const resource = createResource();

    store.retain('live-session-id', resource);

    expect(store.controlsFor('live-session-id')).toBeNull();
  });

  test('invalidates stale retained controls after replacement and release', () => {
    const store = createHostBroadcastPublishingSessionStore();
    const firstControls = createLocalMediaControls();
    const secondControls = createLocalMediaControls();
    const firstResource = createResource(firstControls);
    const secondResource = createResource(secondControls);

    store.retain('live-session-id', firstResource);
    expect(store.controlsFor('live-session-id')).toBe(firstControls);

    store.retain('live-session-id', secondResource);
    expect(store.controlsFor('live-session-id')).toBe(secondControls);
    expect(firstResource.disposeCount()).toBe(1);
    expect(firstResource.disconnectCount()).toBe(1);

    expect(
      releaseHostBroadcastPublishingRetainedResource(
        'live-session-id',
        firstResource,
        store,
      ),
    ).toBe(false);
    expect(store.controlsFor('live-session-id')).toBe(secondControls);

    store.release('live-session-id');

    expect(store.controlsFor('live-session-id')).toBeNull();
    expect(secondResource.disposeCount()).toBe(1);
    expect(secondResource.disconnectCount()).toBe(1);
  });

  test('ignores stale retained-resource termination after a replacement is retained for the same session', () => {
    const store = createHostBroadcastPublishingSessionStore();
    const firstResource = createResource();
    const secondResource = createResource();

    store.retain('live-session-id', firstResource);
    store.retain('live-session-id', secondResource);

    expect(firstResource.disposeCount()).toBe(1);
    expect(firstResource.disconnectCount()).toBe(1);
    expect(store.has('live-session-id')).toBe(true);

    expect(
      releaseHostBroadcastPublishingRetainedResource(
        'live-session-id',
        firstResource,
        store,
      ),
    ).toBe(false);

    expect(secondResource.disposeCount()).toBe(0);
    expect(secondResource.disconnectCount()).toBe(0);
    expect(store.has('live-session-id')).toBe(true);

    expect(
      releaseHostBroadcastPublishingRetainedResource(
        'live-session-id',
        secondResource,
        store,
      ),
    ).toBe(true);
    expect(secondResource.disposeCount()).toBe(1);
    expect(secondResource.disconnectCount()).toBe(1);
    expect(store.has('live-session-id')).toBe(false);
  });

  test('releases the current retained publishing resource and clears local ownership', () => {
    const store = createHostBroadcastPublishingSessionStore();
    const resource = createResource();
    const liveSessionIdsByResource = new Map([
      [resource, 'live-session-id'],
    ]);
    let currentResource: HostBroadcastPublishingResource | null = resource;

    store.retain('live-session-id', resource);

    expect(
      releaseCurrentRetainedHostPublishingResource({
        clearCurrentResource: (releasedResource) => {
          if (currentResource === releasedResource) {
            currentResource = null;
          }
        },
        currentResource,
        liveSessionIdsByResource,
        store,
      }),
    ).toBe('live-session-id');

    expect(currentResource).toBeNull();
    expect(liveSessionIdsByResource.has(resource)).toBe(false);
    expect(store.has('live-session-id')).toBe(false);
    expect(resource.disposeCount()).toBe(1);
    expect(resource.disconnectCount()).toBe(1);
  });

  test('does not report a stale retained publishing resource release', () => {
    const store = createHostBroadcastPublishingSessionStore();
    const staleResource = createResource();
    const retainedResource = createResource();
    const liveSessionIdsByResource = new Map([
      [staleResource, 'live-session-id'],
      [retainedResource, 'live-session-id'],
    ]);
    let currentResource: HostBroadcastPublishingResource | null = staleResource;

    store.retain('live-session-id', staleResource);
    store.retain('live-session-id', retainedResource);

    expect(
      releaseCurrentRetainedHostPublishingResource({
        clearCurrentResource: (releasedResource) => {
          if (currentResource === releasedResource) {
            currentResource = null;
          }
        },
        currentResource,
        liveSessionIdsByResource,
        store,
      }),
    ).toBeNull();

    expect(currentResource).toBe(staleResource);
    expect(liveSessionIdsByResource.has(staleResource)).toBe(true);
    expect(liveSessionIdsByResource.has(retainedResource)).toBe(true);
    expect(store.has('live-session-id')).toBe(true);
    expect(retainedResource.disposeCount()).toBe(0);
    expect(retainedResource.disconnectCount()).toBe(0);
  });

  test('ends sessions only when a retained publishing resource closes', () => {
    const endedSessionIds: string[] = [];

    expect(
      handleReleasedRetainedHostPublishingSessionTermination(
        'closed',
        null,
        (liveSessionId) => {
          endedSessionIds.push(liveSessionId);
        },
      ),
    ).toBe(false);
    expect(endedSessionIds).toEqual([]);

    expect(
      handleReleasedRetainedHostPublishingSessionTermination(
        'errored',
        'live-session-id',
        (liveSessionId) => {
          endedSessionIds.push(liveSessionId);
        },
      ),
    ).toBe(true);
    expect(endedSessionIds).toEqual([]);

    expect(
      handleReleasedRetainedHostPublishingSessionTermination(
        'closed',
        'live-session-id',
        (liveSessionId) => {
          endedSessionIds.push(liveSessionId);
        },
      ),
    ).toBe(true);
    expect(endedSessionIds).toEqual(['live-session-id']);
  });

  test('ignores transient channel errors for retained publishing resources', () => {
    expect(
      shouldIgnoreRetainedHostPublishingChannelTermination(
        'errored',
        'live-session-id',
      ),
    ).toBe(true);
    expect(
      shouldIgnoreRetainedHostPublishingChannelTermination(
        'closed',
        'live-session-id',
      ),
    ).toBe(false);
    expect(
      shouldIgnoreRetainedHostPublishingChannelTermination('errored', null),
    ).toBe(false);
  });

  test('releases retained publishing resources when auth leaves authenticated state', () => {
    const store = createHostBroadcastPublishingSessionStore();
    const resource = createResource();

    store.retain('live-session-id', resource);
    expect(
      releaseHostBroadcastPublishingAfterAuthStateChange(
        'authenticated',
        'authenticated',
        store,
      ),
    ).toEqual([]);

    expect(store.has('live-session-id')).toBe(true);
    expect(resource.disposeCount()).toBe(0);
    expect(resource.disconnectCount()).toBe(0);

    expect(
      releaseHostBroadcastPublishingAfterAuthStateChange(
        'authenticated',
        'unauthenticated',
        store,
      ),
    ).toEqual(['live-session-id']);

    expect(store.has('live-session-id')).toBe(false);
    expect(resource.disposeCount()).toBe(1);
    expect(resource.disconnectCount()).toBe(1);
  });

  test('ends retained live sessions before auth loss clears the access token', async () => {
    const store = createHostBroadcastPublishingSessionStore();
    const resource = createResource();
    const requests: Array<{
      readonly authorization: string | null;
      readonly liveSessionId: string;
    }> = [];
    const fetchImpl: typeof fetch = (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      const body = JSON.parse(String(init?.body)) as {
        readonly variables: { readonly input: { readonly liveSessionId: string } };
      };
      requests.push({
        authorization: headers.Authorization ?? null,
        liveSessionId: body.variables.input.liveSessionId,
      });
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              endLiveSession: {
                errors: [],
                liveSession: { id: body.variables.input.liveSessionId },
              },
            },
          }),
          { status: 200 },
        ),
      );
    };

    store.retain('live-session-id', resource);

    await expect(
      releaseHostBroadcastPublishingBeforeAuthLoss({
        apiBaseUrl: 'https://api.example.test',
        fetchImpl,
        getAccessToken: () => 'access-token',
        store,
      }),
    ).resolves.toEqual(['live-session-id']);

    expect(requests).toEqual([
      {
        authorization: 'Bearer access-token',
        liveSessionId: 'live-session-id',
      },
    ]);
    expect(store.has('live-session-id')).toBe(false);
    expect(resource.disposeCount()).toBe(1);
    expect(resource.disconnectCount()).toBe(1);

    expect(
      releaseHostBroadcastPublishingAfterAuthStateChange(
        'authenticated',
        'unauthenticated',
        store,
      ),
    ).toEqual([]);
    expect(resource.disposeCount()).toBe(1);
    expect(resource.disconnectCount()).toBe(1);
  });

  test('retains publishing resources when auth-loss session end returns HTTP failure', async () => {
    const store = createHostBroadcastPublishingSessionStore();
    const resource = createResource();
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(new Response('unauthorized', { status: 401 }));

    store.retain('live-session-id', resource);

    await expect(
      releaseHostBroadcastPublishingBeforeAuthLoss({
        apiBaseUrl: 'https://api.example.test',
        fetchImpl,
        getAccessToken: () => 'expired-access-token',
        store,
      }),
    ).resolves.toEqual([]);

    expect(store.has('live-session-id')).toBe(true);
    expect(resource.disposeCount()).toBe(0);
    expect(resource.disconnectCount()).toBe(0);
  });

  test('releases local publishing resources after auth-loss session end fails', async () => {
    const store = createHostBroadcastPublishingSessionStore();
    const resource = createResource();
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(new Response('unauthorized', { status: 401 }));

    store.retain('live-session-id', resource);

    await expect(
      releaseHostBroadcastPublishingBeforeAuthLoss({
        apiBaseUrl: 'https://api.example.test',
        fetchImpl,
        getAccessToken: () => 'expired-access-token',
        store,
      }),
    ).resolves.toEqual([]);

    expect(store.has('live-session-id')).toBe(true);
    expect(resource.disposeCount()).toBe(0);
    expect(resource.disconnectCount()).toBe(0);

    expect(
      releaseHostBroadcastPublishingAfterAuthStateChange(
        'authenticated',
        'unauthenticated',
        store,
      ),
    ).toEqual(['live-session-id']);
    expect(store.has('live-session-id')).toBe(false);
    expect(resource.disposeCount()).toBe(1);
    expect(resource.disconnectCount()).toBe(1);
  });

  test('retains publishing resources when auth-loss session end returns GraphQL errors', async () => {
    const store = createHostBroadcastPublishingSessionStore();
    const resource = createResource();
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              endLiveSession: {
                errors: [{ message: 'Token has expired.' }],
                liveSession: null,
              },
            },
          }),
          { status: 200 },
        ),
      );

    store.retain('live-session-id', resource);

    await expect(
      releaseHostBroadcastPublishingBeforeAuthLoss({
        apiBaseUrl: 'https://api.example.test',
        fetchImpl,
        getAccessToken: () => 'expired-access-token',
        store,
      }),
    ).resolves.toEqual([]);

    expect(store.has('live-session-id')).toBe(true);
    expect(resource.disposeCount()).toBe(0);
    expect(resource.disconnectCount()).toBe(0);
  });

  test('aborts hung auth-loss session end requests', async () => {
    const store = createHostBroadcastPublishingSessionStore();
    const resource = createResource();
    let abortListenerAttached = false;
    let abortReceived = false;
    const fetchImpl: typeof fetch = (_url, init) => {
      const signal = init?.signal;

      return new Promise<Response>((resolve) => {
        if (!signal) {
          resolve(new Response('missing abort signal', { status: 599 }));
          return;
        }

        abortListenerAttached = true;
        signal.addEventListener(
          'abort',
          () => {
            abortReceived = true;
            resolve(new Response('aborted', { status: 408 }));
          },
          { once: true },
        );
      });
    };

    store.retain('live-session-id', resource);

    await expect(
      releaseHostBroadcastPublishingBeforeAuthLoss({
        apiBaseUrl: 'https://api.example.test',
        endLiveSessionTimeoutMs: 1,
        fetchImpl,
        getAccessToken: () => 'access-token',
        store,
      }),
    ).resolves.toEqual([]);

    expect(abortListenerAttached).toBe(true);
    expect(abortReceived).toBe(true);
    expect(store.has('live-session-id')).toBe(true);
    expect(resource.disposeCount()).toBe(0);
    expect(resource.disconnectCount()).toBe(0);
  });

  test('does not release a replacement retained resource after stale auth-loss cleanup succeeds', async () => {
    const store = createHostBroadcastPublishingSessionStore();
    const firstResource = createResource();
    const replacementResource = createResource();
    const deferred = createDeferredResponse();
    const fetchImpl: typeof fetch = () => deferred.promise;

    store.retain('live-session-id', firstResource);
    const releasePromise = releaseHostBroadcastPublishingBeforeAuthLoss({
      apiBaseUrl: 'https://api.example.test',
      fetchImpl,
      getAccessToken: () => 'access-token',
      store,
    });

    store.retain('live-session-id', replacementResource);
    deferred.resolve(
      new Response(
        JSON.stringify({
          data: {
            endLiveSession: {
              errors: [],
              liveSession: { id: 'live-session-id' },
            },
          },
        }),
        { status: 200 },
      ),
    );

    await expect(releasePromise).resolves.toEqual([]);

    expect(store.has('live-session-id')).toBe(true);
    expect(firstResource.disposeCount()).toBe(1);
    expect(firstResource.disconnectCount()).toBe(1);
    expect(replacementResource.disposeCount()).toBe(0);
    expect(replacementResource.disconnectCount()).toBe(0);
  });

  test('does not release retained publishing resources without auth loss', () => {
    const store = createHostBroadcastPublishingSessionStore();
    const resource = createResource();

    store.retain('live-session-id', resource);
    releaseHostBroadcastPublishingAfterAuthStateChange(
      'loading',
      'unauthenticated',
      store,
    );
    releaseHostBroadcastPublishingAfterAuthStateChange(
      'unauthenticated',
      'unauthenticated',
      store,
    );
    releaseHostBroadcastPublishingAfterAuthStateChange(
      'loading',
      'authenticated',
      store,
    );

    expect(store.has('live-session-id')).toBe(true);
    expect(resource.disposeCount()).toBe(0);
    expect(resource.disconnectCount()).toBe(0);
  });
});
