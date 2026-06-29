import { describe, expect, test } from 'bun:test';

import {
  createHostBroadcastLocalMediaControls,
  type HostBroadcastLocalMediaTrack,
} from '../../src/host/publishing/hostBroadcastLocalMediaControls';

function createStream(tracks: ReadonlyArray<unknown>) {
  return {
    getTracks() {
      return tracks;
    },
  };
}

describe('hostBroadcastLocalMediaControls', () => {
  test('toggles audio tracks without touching video tracks', () => {
    const audioTrack: HostBroadcastLocalMediaTrack = {
      enabled: true,
      kind: 'audio',
    };
    const videoTrack: HostBroadcastLocalMediaTrack = {
      enabled: true,
      kind: 'video',
    };
    const controls = createHostBroadcastLocalMediaControls(
      createStream([audioTrack, videoTrack]),
    );

    expect(controls?.snapshot()).toEqual({
      audio: { available: true, enabled: true },
      video: { available: true, enabled: true },
    });

    controls?.setAudioEnabled(false);

    expect(audioTrack.enabled).toBe(false);
    expect(videoTrack.enabled).toBe(true);
    expect(controls?.snapshot()).toEqual({
      audio: { available: true, enabled: false },
      video: { available: true, enabled: true },
    });
  });

  test('toggles video tracks without touching audio tracks', () => {
    const audioTrack: HostBroadcastLocalMediaTrack = {
      enabled: true,
      kind: 'audio',
    };
    const firstVideoTrack: HostBroadcastLocalMediaTrack = {
      enabled: true,
      kind: 'video',
    };
    const secondVideoTrack: HostBroadcastLocalMediaTrack = {
      kind: 'video',
    };
    const controls = createHostBroadcastLocalMediaControls(
      createStream([audioTrack, firstVideoTrack, secondVideoTrack]),
    );

    controls?.setVideoEnabled(false);

    expect(audioTrack.enabled).toBe(true);
    expect(firstVideoTrack.enabled).toBe(false);
    expect(secondVideoTrack.enabled).toBe(false);
    expect(controls?.snapshot()).toEqual({
      audio: { available: true, enabled: true },
      video: { available: true, enabled: false },
    });
  });

  test('reports unavailable groups for missing tracks', () => {
    const controls = createHostBroadcastLocalMediaControls(
      createStream([{ enabled: true, kind: 'audio' }]),
    );

    expect(controls?.snapshot()).toEqual({
      audio: { available: true, enabled: true },
      video: { available: false, enabled: false },
    });

    controls?.setVideoEnabled(false);

    expect(controls?.snapshot()).toEqual({
      audio: { available: true, enabled: true },
      video: { available: false, enabled: false },
    });
  });

  test('ignores stopped and malformed tracks safely', () => {
    const stoppedAudioTrack: HostBroadcastLocalMediaTrack = {
      enabled: false,
      kind: 'audio',
      readyState: 'ended',
    };
    const liveAudioTrack: HostBroadcastLocalMediaTrack = {
      enabled: true,
      kind: 'audio',
    };
    const malformedTrack = { enabled: true };
    const controls = createHostBroadcastLocalMediaControls(
      createStream([
        stoppedAudioTrack,
        liveAudioTrack,
        malformedTrack,
        null,
        'video',
      ]),
    );

    controls?.setAudioEnabled(false);
    controls?.setVideoEnabled(false);

    expect(stoppedAudioTrack.enabled).toBe(false);
    expect(liveAudioTrack.enabled).toBe(false);
    expect(malformedTrack.enabled).toBe(true);
    expect(controls?.snapshot()).toEqual({
      audio: { available: true, enabled: false },
      video: { available: false, enabled: false },
    });
  });

  test('treats a group as enabled only when every available track is enabled', () => {
    const controls = createHostBroadcastLocalMediaControls(
      createStream([
        { enabled: true, kind: 'audio' },
        { enabled: false, kind: 'audio' },
        { kind: 'video' },
      ]),
    );

    expect(controls?.snapshot()).toEqual({
      audio: { available: true, enabled: false },
      video: { available: true, enabled: true },
    });
  });
});
