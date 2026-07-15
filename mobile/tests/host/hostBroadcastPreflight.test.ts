import { describe, expect, test } from 'vitest';

import {
  canCreateHostPreflightSession,
  canGoLiveFromHostPreflight,
  createHostBroadcastPreflightState,
  hostBroadcastPreflightBlockers,
  hostBroadcastPreflightReducer,
} from '../../src/host/hostBroadcastPreflight';

describe('hostBroadcastPreflight', () => {
  test('blocks session creation until permissions and native media are ready', () => {
    const initial = createHostBroadcastPreflightState();

    expect(canCreateHostPreflightSession(initial)).toBe(false);
    expect(hostBroadcastPreflightBlockers(initial)).toEqual([
      { reason: 'camera_permission', userActionable: true },
      { reason: 'microphone_permission', userActionable: true },
      { reason: 'native_media', userActionable: false },
      { reason: 'backend_media_contract', userActionable: false },
    ]);

    const cameraReady = hostBroadcastPreflightReducer(initial, {
      permission: 'camera',
      state: 'granted',
      type: 'permission_changed',
    });
    const microphoneReady = hostBroadcastPreflightReducer(cameraReady, {
      permission: 'microphone',
      state: 'granted',
      type: 'permission_changed',
    });

    expect(canCreateHostPreflightSession(microphoneReady)).toBe(false);
    expect(hostBroadcastPreflightBlockers(microphoneReady)).toEqual([
      { reason: 'native_media', userActionable: false },
      { reason: 'backend_media_contract', userActionable: false },
    ]);

    const nativeReady = hostBroadcastPreflightReducer(microphoneReady, {
      ready: true,
      type: 'native_media_changed',
    });

    expect(canCreateHostPreflightSession(nativeReady)).toBe(true);
    expect(canGoLiveFromHostPreflight(nativeReady)).toBe(false);
    expect(hostBroadcastPreflightBlockers(nativeReady)).toEqual([
      { reason: 'backend_media_contract', userActionable: false },
    ]);
  });

  test('keeps go-live blocked until backend media negotiation is available', () => {
    const preflightReady = hostBroadcastPreflightReducer(
      hostBroadcastPreflightReducer(
        hostBroadcastPreflightReducer(createHostBroadcastPreflightState(), {
          permission: 'camera',
          state: 'granted',
          type: 'permission_changed',
        }),
        {
          permission: 'microphone',
          state: 'granted',
          type: 'permission_changed',
        },
      ),
      {
        ready: true,
        type: 'native_media_changed',
      },
    );

    expect(canCreateHostPreflightSession(preflightReady)).toBe(true);
    expect(canGoLiveFromHostPreflight(preflightReady)).toBe(false);

    const backendReady = hostBroadcastPreflightReducer(preflightReady, {
      ready: true,
      type: 'backend_media_contract_changed',
    });

    expect(canCreateHostPreflightSession(backendReady)).toBe(true);
    expect(canGoLiveFromHostPreflight(backendReady)).toBe(true);
    expect(hostBroadcastPreflightBlockers(backendReady)).toEqual([]);

    const backendPending = hostBroadcastPreflightReducer(backendReady, {
      ready: false,
      type: 'backend_media_contract_changed',
    });

    expect(canCreateHostPreflightSession(backendPending)).toBe(true);
    expect(canGoLiveFromHostPreflight(backendPending)).toBe(false);
    expect(hostBroadcastPreflightBlockers(backendPending)).toEqual([
      { reason: 'backend_media_contract', userActionable: false },
    ]);
  });

  test('reports denied and blocked permissions as user-actionable blockers', () => {
    const deniedCamera = hostBroadcastPreflightReducer(
      createHostBroadcastPreflightState(),
      {
        permission: 'camera',
        state: 'denied',
        type: 'permission_changed',
      },
    );
    const blockedMicrophone = hostBroadcastPreflightReducer(deniedCamera, {
      permission: 'microphone',
      state: 'blocked',
      type: 'permission_changed',
    });

    expect(canCreateHostPreflightSession(blockedMicrophone)).toBe(false);
    expect(hostBroadcastPreflightBlockers(blockedMicrophone)).toEqual([
      { reason: 'camera_permission', userActionable: true },
      { reason: 'microphone_permission', userActionable: true },
      { reason: 'native_media', userActionable: false },
      { reason: 'backend_media_contract', userActionable: false },
    ]);
  });

  test('resets preflight state to initial readiness', () => {
    const ready = hostBroadcastPreflightReducer(
      hostBroadcastPreflightReducer(
        hostBroadcastPreflightReducer(
          hostBroadcastPreflightReducer(createHostBroadcastPreflightState(), {
            permission: 'camera',
            state: 'granted',
            type: 'permission_changed',
          }),
          {
            permission: 'microphone',
            state: 'granted',
            type: 'permission_changed',
          },
        ),
        {
          ready: true,
          type: 'native_media_changed',
        },
      ),
      {
        ready: true,
        type: 'backend_media_contract_changed',
      },
    );

    expect(canGoLiveFromHostPreflight(ready)).toBe(true);
    expect(
      hostBroadcastPreflightReducer(ready, {
        type: 'reset',
      }),
    ).toEqual(createHostBroadcastPreflightState());
  });
});
