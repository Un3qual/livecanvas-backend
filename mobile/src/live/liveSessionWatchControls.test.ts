import { describe, expect, test } from 'bun:test';

import {
  canStartLiveSessionViewerJoin,
  shouldShowLiveSessionViewerJoinControl,
} from './liveSessionWatchControls';

describe('liveSessionWatchControls', () => {
  test('shows viewer join control for enterable viewer sessions before joining', () => {
    expect(
      shouldShowLiveSessionViewerJoinControl({
        canEndLiveSession: false,
        isJoined: false,
      }),
    ).toBe(true);
  });

  test('hides viewer join control once the viewer has joined', () => {
    expect(
      shouldShowLiveSessionViewerJoinControl({
        canEndLiveSession: false,
        isJoined: true,
      }),
    ).toBe(false);
  });

  test('hides viewer join control for host-owned sessions', () => {
    expect(
      shouldShowLiveSessionViewerJoinControl({
        canEndLiveSession: true,
        isJoined: false,
      }),
    ).toBe(false);
  });

  test('blocks viewer join submission for host-owned sessions', () => {
    expect(
      canStartLiveSessionViewerJoin({
        canEndLiveSession: true,
        enterable: true,
        hasActiveSubmission: false,
        hasPendingMutation: false,
        isJoined: false,
      }),
    ).toBe(false);
  });

  test('allows viewer join submission for enterable idle viewer sessions', () => {
    expect(
      canStartLiveSessionViewerJoin({
        canEndLiveSession: false,
        enterable: true,
        hasActiveSubmission: false,
        hasPendingMutation: false,
        isJoined: false,
      }),
    ).toBe(true);
  });
});
