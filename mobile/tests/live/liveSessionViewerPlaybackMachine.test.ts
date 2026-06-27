import { describe, expect, test } from 'bun:test';
import { createActor } from 'xstate';

import {
  liveSessionViewerPlaybackMachine,
  selectLiveSessionViewerPlaybackState,
} from '../../src/live/watch/state/liveSessionViewerPlaybackMachine';

function startMachine() {
  return createActor(liveSessionViewerPlaybackMachine).start();
}

describe('liveSessionViewerPlaybackMachine', () => {
  test('starts idle and moves through prepare, connect, waiting, and playing', () => {
    const actor = startMachine();

    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'idle',
    });

    actor.send({ type: 'PREPARE_REQUESTED' });
    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'preparing',
    });

    actor.send({ type: 'CONNECT_REQUESTED' });
    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'connecting',
    });

    actor.send({ type: 'RUNTIME_STARTED' });
    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'waiting_for_host',
    });

    actor.send({
      remoteStreamUrl: 'stream://host-camera',
      type: 'REMOTE_STREAM_RECEIVED',
    });
    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: 'stream://host-camera',
      status: 'playing',
    });
  });

  test('keeps playing when the remote stream arrives before runtime start resolves', () => {
    const actor = startMachine();

    actor.send({ type: 'PREPARE_REQUESTED' });
    actor.send({ type: 'CONNECT_REQUESTED' });
    actor.send({
      remoteStreamUrl: 'stream://early-camera',
      type: 'REMOTE_STREAM_RECEIVED',
    });
    actor.send({ type: 'RUNTIME_STARTED' });

    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: 'stream://early-camera',
      status: 'playing',
    });
  });

  test('closes without carrying an error or stream URL', () => {
    const actor = startMachine();

    actor.send({ type: 'PREPARE_REQUESTED' });
    actor.send({ type: 'CONNECT_REQUESTED' });
    actor.send({
      remoteStreamUrl: 'stream://host-camera',
      type: 'REMOTE_STREAM_RECEIVED',
    });
    actor.send({ type: 'CLOSED' });

    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'closed',
    });
  });

  test('records failures and reset returns to the initial display state', () => {
    const actor = startMachine();

    actor.send({ type: 'PREPARE_REQUESTED' });
    actor.send({
      error: 'Live video playback is not available on this device.',
      type: 'FAILED',
    });

    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: 'Live video playback is not available on this device.',
      remoteStreamUrl: null,
      status: 'errored',
    });

    actor.send({ type: 'RESET' });

    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'idle',
    });
  });
});
