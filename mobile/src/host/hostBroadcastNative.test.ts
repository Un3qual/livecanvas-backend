import { describe, expect, test } from 'bun:test';

import {
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
    expect(normalizeHostBroadcastPermission(undefined)).toBe('unknown');
    expect(normalizeHostBroadcastPermission('prompt')).toBe('unknown');
    expect(normalizeHostBroadcastPermission(1)).toBe('unknown');
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
