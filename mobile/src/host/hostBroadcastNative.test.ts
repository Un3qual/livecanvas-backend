import { describe, expect, test } from 'bun:test';

import {
  createHostBroadcastNative,
  createUnavailableHostBroadcastNative,
  normalizeHostBroadcastPermission,
} from './hostBroadcastNative';

describe('hostBroadcastNative', () => {
  test('normalizes booleans and known string permission states', () => {
    expect(normalizeHostBroadcastPermission(true)).toBe('granted');
    expect(normalizeHostBroadcastPermission(false)).toBe('denied');
    expect(normalizeHostBroadcastPermission('unknown')).toBe('unknown');
    expect(normalizeHostBroadcastPermission('granted')).toBe('granted');
    expect(normalizeHostBroadcastPermission('denied')).toBe('denied');
    expect(normalizeHostBroadcastPermission('blocked')).toBe('blocked');
  });

  test('normalizes unknown permission values to unknown', () => {
    expect(normalizeHostBroadcastPermission(null)).toBe('unknown');
    expect(normalizeHostBroadcastPermission()).toBe('unknown');
    expect(normalizeHostBroadcastPermission('prompt')).toBe('unknown');
    expect(normalizeHostBroadcastPermission(1)).toBe('unknown');
  });

  test('creates a real native boundary when media devices are available', async () => {
    let getUserMediaCallCount = 0;
    let stoppedTrackCount = 0;
    const track = {
      stop() {
        stoppedTrackCount += 1;
      },
    };
    const stream = {
      getTracks() {
        return [track];
      },
    };
    const native = createHostBroadcastNative({
      mediaDevices: {
        async getUserMedia() {
          getUserMediaCallCount += 1;
          return stream;
        },
      },
    });

    await expect(native.requestPermissions()).resolves.toEqual({
      camera: 'granted',
      microphone: 'granted',
    });
    await expect(native.preparePreview()).resolves.toEqual({
      status: 'native_media_ready',
    });

    native.dispose();
    native.dispose();

    expect(getUserMediaCallCount).toBe(1);
    expect(stoppedTrackCount).toBe(1);
  });

  test('shares an in-flight preview request across preflight calls', async () => {
    let getUserMediaCallCount = 0;
    let stoppedTrackCount = 0;
    let isCapturing = false;
    const track = {
      stop() {
        stoppedTrackCount += 1;
      },
    };
    const stream = {
      getTracks() {
        return [track];
      },
    };
    const native = createHostBroadcastNative({
      mediaDevices: {
        async getUserMedia() {
          getUserMediaCallCount += 1;

          if (isCapturing) {
            throw new Error('native_media_busy');
          }

          isCapturing = true;
          await Promise.resolve();
          isCapturing = false;
          return stream;
        },
      },
    });

    await expect(
      Promise.all([native.requestPermissions(), native.preparePreview()]),
    ).resolves.toEqual([
      {
        camera: 'granted',
        microphone: 'granted',
      },
      {
        status: 'native_media_ready',
      },
    ]);

    native.dispose();

    expect(getUserMediaCallCount).toBe(1);
    expect(stoppedTrackCount).toBe(1);
  });

  test('falls back when media devices are unavailable', async () => {
    const native = createHostBroadcastNative({ mediaDevices: null });

    await expect(native.preparePreview()).resolves.toEqual({
      status: 'native_media_unavailable',
    });
  });

  test('unavailable native boundary returns safe preflight defaults', async () => {
    const native = createUnavailableHostBroadcastNative();

    await expect(native.requestPermissions()).resolves.toEqual({
      camera: 'unknown',
      microphone: 'unknown',
    });

    await expect(native.preparePreview()).resolves.toEqual({
      status: 'native_media_unavailable',
    });

    expect(() => native.dispose()).not.toThrow();
    expect(() => native.dispose()).not.toThrow();
  });
});
