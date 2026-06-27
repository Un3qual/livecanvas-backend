import { describe, expect, test } from 'bun:test';

import {
  createDefaultHostBroadcastPeerConnectionFactory as createNestedPeerConnectionFactory,
  createHostBroadcastPublishingRuntime as createNestedRuntime,
} from '../../src/host/publishing/hostBroadcastPublishingRuntime';
import {
  createHostBroadcastPublishingPreflightController as createNestedPreflightController,
  createHostBroadcastPublishingSessionStore as createNestedSessionStore,
  disposeHostBroadcastPublishingResource as disposeNestedResource,
  handleReleasedRetainedHostPublishingSessionTermination as handleNestedTermination,
  releaseCurrentRetainedHostPublishingResource as releaseNestedCurrentResource,
  releaseHostBroadcastPublishingRetainedResource as releaseNestedRetainedResource,
  shouldIgnoreRetainedHostPublishingChannelTermination as shouldNestedIgnoreTermination,
} from '../../src/host/publishing/hostBroadcastPublishingSessionStore';
import {
  releaseHostBroadcastPublishingAfterAuthStateChange as releaseNestedAfterAuthStateChange,
  releaseHostBroadcastPublishingBeforeAuthLoss as releaseNestedBeforeAuthLoss,
} from '../../src/host/publishing/hostBroadcastPublishingAuthCleanup';
import {
  createDefaultHostBroadcastPeerConnectionFactory as createPublicPeerConnectionFactory,
  createHostBroadcastPublishingRuntime as createPublicRuntime,
} from '../../src/host/hostBroadcastPublishingRuntime';
import {
  createHostBroadcastPublishingPreflightController as createPublicPreflightController,
  createHostBroadcastPublishingSessionStore as createPublicSessionStore,
  disposeHostBroadcastPublishingResource as disposePublicResource,
  handleReleasedRetainedHostPublishingSessionTermination as handlePublicTermination,
  releaseCurrentRetainedHostPublishingResource as releasePublicCurrentResource,
  releaseHostBroadcastPublishingAfterAuthStateChange as releasePublicAfterAuthStateChange,
  releaseHostBroadcastPublishingBeforeAuthLoss as releasePublicBeforeAuthLoss,
  releaseHostBroadcastPublishingRetainedResource as releasePublicRetainedResource,
  shouldIgnoreRetainedHostPublishingChannelTermination as shouldPublicIgnoreTermination,
} from '../../src/host/hostBroadcastPublishingSession';

describe('host publishing module boundaries', () => {
  test('keeps the public runtime module as a compatibility shim', () => {
    expect(createPublicRuntime).toBe(createNestedRuntime);
    expect(createPublicPeerConnectionFactory).toBe(
      createNestedPeerConnectionFactory,
    );
  });

  test('keeps the public session module as a compatibility shim', () => {
    expect(createPublicSessionStore).toBe(createNestedSessionStore);
    expect(createPublicPreflightController).toBe(
      createNestedPreflightController,
    );
    expect(disposePublicResource).toBe(disposeNestedResource);
    expect(releasePublicRetainedResource).toBe(releaseNestedRetainedResource);
    expect(releasePublicCurrentResource).toBe(releaseNestedCurrentResource);
    expect(handlePublicTermination).toBe(handleNestedTermination);
    expect(shouldPublicIgnoreTermination).toBe(shouldNestedIgnoreTermination);
    expect(releasePublicAfterAuthStateChange).toBe(
      releaseNestedAfterAuthStateChange,
    );
    expect(releasePublicBeforeAuthLoss).toBe(releaseNestedBeforeAuthLoss);
  });
});
