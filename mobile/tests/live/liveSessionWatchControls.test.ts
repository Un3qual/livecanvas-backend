import { describe, expect, test } from 'bun:test';

import {
  canStartLiveSessionViewerJoin,
  shouldShowLiveSessionViewerJoinControl,
} from '../../src/live/liveSessionWatchControls';

describe('liveSessionWatchControls', () => {
  test('shows viewer join control for enterable viewer sessions before joining', () => {
    expect(
      shouldShowLiveSessionViewerJoinControl({
        isHostOwnedSession: false,
        isJoined: false,
      }),
    ).toBe(true);
  });

  test('hides viewer join control once the viewer has joined', () => {
    expect(
      shouldShowLiveSessionViewerJoinControl({
        isHostOwnedSession: false,
        isJoined: true,
      }),
    ).toBe(false);
  });

  test('hides viewer join control for host-owned sessions', () => {
    expect(
      shouldShowLiveSessionViewerJoinControl({
        isHostOwnedSession: true,
        isJoined: false,
      }),
    ).toBe(false);
  });

  test('hides viewer join control for ended host-owned sessions', () => {
    expect(
      shouldShowLiveSessionViewerJoinControl({
        isHostOwnedSession: true,
        isJoined: false,
      }),
    ).toBe(false);
  });

  test('blocks viewer join submission for host-owned sessions', () => {
    expect(
      canStartLiveSessionViewerJoin({
        enterable: true,
        hasActiveSubmission: false,
        hasPendingMutation: false,
        isHostOwnedSession: true,
        isJoined: false,
      }),
    ).toBe(false);
  });

  test('blocks viewer join submission for ended host-owned sessions', () => {
    expect(
      canStartLiveSessionViewerJoin({
        enterable: true,
        hasActiveSubmission: false,
        hasPendingMutation: false,
        isHostOwnedSession: true,
        isJoined: false,
      }),
    ).toBe(false);
  });

  test('allows viewer join submission for enterable idle viewer sessions', () => {
    expect(
      canStartLiveSessionViewerJoin({
        enterable: true,
        hasActiveSubmission: false,
        hasPendingMutation: false,
        isHostOwnedSession: false,
        isJoined: false,
      }),
    ).toBe(true);
  });
});
