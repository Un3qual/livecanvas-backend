import { describe, expect, test } from 'bun:test';

import {
  createHostBroadcastPublishingPreflightController,
  createHostBroadcastPublishingSessionStore,
  releaseHostBroadcastPublishingAfterSuccessfulLeave,
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
    expect(controller.retainForLiveSession('live-session-id', store)).toBe(true);
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

    expect(controller.retainForLiveSession('live-session-id', store)).toBe(false);
    expect(store.has('live-session-id')).toBe(false);
  });

  test('releases retained publishing resources after successful leave', () => {
    const store = createHostBroadcastPublishingSessionStore();
    const resource = createResource();
    store.retain('live-session-id', resource);

    releaseHostBroadcastPublishingAfterSuccessfulLeave(
      'live-session-id',
      { errors: [], left: true },
      store,
    );

    expect(resource.disposeCount()).toBe(1);
    expect(resource.disconnectCount()).toBe(1);
    expect(store.has('live-session-id')).toBe(false);
  });

  test('keeps retained publishing resources after failed leave', () => {
    const store = createHostBroadcastPublishingSessionStore();
    const failedLeftResource = createResource();
    const errorResource = createResource();
    store.retain('failed-left-session-id', failedLeftResource);
    store.retain('error-session-id', errorResource);

    releaseHostBroadcastPublishingAfterSuccessfulLeave(
      'failed-left-session-id',
      { errors: [], left: false },
      store,
    );
    releaseHostBroadcastPublishingAfterSuccessfulLeave(
      'error-session-id',
      { errors: [{ message: 'not_authorized' }], left: true },
      store,
    );
    releaseHostBroadcastPublishingAfterSuccessfulLeave(
      'missing-session-id',
      { errors: [], left: true },
      store,
    );

    expect(failedLeftResource.disposeCount()).toBe(0);
    expect(failedLeftResource.disconnectCount()).toBe(0);
    expect(store.has('failed-left-session-id')).toBe(true);
    expect(errorResource.disposeCount()).toBe(0);
    expect(errorResource.disconnectCount()).toBe(0);
    expect(store.has('error-session-id')).toBe(true);
  });
});
