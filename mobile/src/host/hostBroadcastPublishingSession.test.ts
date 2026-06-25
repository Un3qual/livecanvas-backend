import { describe, expect, test } from 'bun:test';

import {
  createHostBroadcastPublishingPreflightController,
  createHostBroadcastPublishingSessionStore,
  releaseHostBroadcastPublishingAfterAuthStateChange,
  releaseHostBroadcastPublishingRetainedResource,
  type HostBroadcastPublishingResource,
} from './hostBroadcastPublishingSession';

function createResource(): HostBroadcastPublishingResource & {
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
  };
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

  test('releases retained publishing resources when auth leaves authenticated state', () => {
    const store = createHostBroadcastPublishingSessionStore();
    const resource = createResource();

    store.retain('live-session-id', resource);
    releaseHostBroadcastPublishingAfterAuthStateChange(
      'authenticated',
      'authenticated',
      store,
    );

    expect(store.has('live-session-id')).toBe(true);
    expect(resource.disposeCount()).toBe(0);
    expect(resource.disconnectCount()).toBe(0);

    releaseHostBroadcastPublishingAfterAuthStateChange(
      'authenticated',
      'unauthenticated',
      store,
    );

    expect(store.has('live-session-id')).toBe(false);
    expect(resource.disposeCount()).toBe(1);
    expect(resource.disconnectCount()).toBe(1);
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
