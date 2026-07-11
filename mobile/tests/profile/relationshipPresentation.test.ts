import { describe, expect, test } from 'bun:test';

import {
  describeRelationshipState,
  type RelationshipAction,
} from '../../src/profile/relationshipPresentation';

const muteAndBlockActions = [
  { destructive: false, kind: 'mute', label: 'Mute' },
  { destructive: true, kind: 'block', label: 'Block' },
] satisfies ReadonlyArray<RelationshipAction>;

const unmuteAndBlockActions = [
  { destructive: false, kind: 'unmute', label: 'Unmute' },
  { destructive: true, kind: 'block', label: 'Block' },
] satisfies ReadonlyArray<RelationshipAction>;

const unfollowMuteAndBlockActions = [
  { destructive: false, kind: 'unfollow', label: 'Unfollow' },
  ...muteAndBlockActions,
] satisfies ReadonlyArray<RelationshipAction>;

const unfollowUnmuteAndBlockActions = [
  { destructive: false, kind: 'unfollow', label: 'Unfollow' },
  ...unmuteAndBlockActions,
] satisfies ReadonlyArray<RelationshipAction>;

const unblockActions = [
  { destructive: false, kind: 'unblock', label: 'Unblock' },
] satisfies ReadonlyArray<RelationshipAction>;

describe('relationshipPresentation', () => {
  test('describes public profiles with a supported follow action', () => {
    expect(
      describeRelationshipState({
        isBlockedByViewer: false,
        isMuted: false,
        state: 'PUBLIC',
      }),
    ).toEqual({
      actionLabel: 'Follow',
      canFollow: true,
      label: 'Public profile',
      socialActions: muteAndBlockActions,
      status: 'You can follow this profile.',
    });
  });

  test('describes non-followed private profiles with a supported request action', () => {
    expect(
      describeRelationshipState({
        isBlockedByViewer: false,
        isMuted: false,
        state: 'NONE',
      }),
    ).toEqual({
      actionLabel: 'Request follow',
      canFollow: true,
      label: 'Not following',
      socialActions: muteAndBlockActions,
      status: 'Send a follow request to see protected activity.',
    });
  });

  test('keeps requested profiles non-actionable', () => {
    expect(
      describeRelationshipState({
        isBlockedByViewer: false,
        isMuted: false,
        state: 'REQUESTED',
      }),
    ).toEqual({
      actionLabel: null,
      canFollow: false,
      label: 'Request pending',
      socialActions: muteAndBlockActions,
      status: 'Your follow request is waiting for approval.',
    });
  });

  test('offers unfollow for accepted profiles and reflects muted state', () => {
    expect(
      describeRelationshipState({
        isBlockedByViewer: false,
        isMuted: false,
        state: 'ACCEPTED',
      }),
    ).toEqual({
      actionLabel: null,
      canFollow: false,
      label: 'Following',
      socialActions: unfollowMuteAndBlockActions,
      status: 'You follow this profile.',
    });

    expect(
      describeRelationshipState({
        isBlockedByViewer: false,
        isMuted: true,
        state: 'ACCEPTED',
      }),
    ).toEqual({
      actionLabel: null,
      canFollow: false,
      label: 'Following',
      socialActions: unfollowUnmuteAndBlockActions,
      status: 'You follow this profile. Notifications are muted.',
    });
  });

  test('offers unblock only for the viewer outbound block direction', () => {
    expect(
      describeRelationshipState({
        isBlockedByViewer: true,
        isMuted: false,
        state: 'BLOCKED',
      }),
    ).toEqual({
      actionLabel: null,
      canFollow: false,
      label: 'Blocked',
      socialActions: unblockActions,
      status: 'You blocked this profile.',
    });

    expect(
      describeRelationshipState({
        isBlockedByViewer: false,
        isMuted: false,
        state: 'BLOCKED',
      }),
    ).toEqual({
      actionLabel: null,
      canFollow: false,
      label: 'Unavailable',
      socialActions: [],
      status: 'This profile is not available.',
    });
  });

  test('keeps future relationship values non-actionable', () => {
    expect(
      describeRelationshipState({
        isBlockedByViewer: false,
        isMuted: false,
        state: '%future added value',
      }),
    ).toEqual({
      actionLabel: null,
      canFollow: false,
      label: 'Relationship unavailable',
      socialActions: [],
      status: 'Refresh later to see the current relationship.',
    });
  });

  test('suppresses relationship actions when the target is the viewer', () => {
    expect(
      describeRelationshipState({
        isBlockedByViewer: false,
        isMuted: false,
        isSelf: true,
        state: 'ACCEPTED',
      }),
    ).toEqual({
      actionLabel: null,
      canFollow: false,
      label: 'Your profile',
      socialActions: [],
      status: 'This is your profile.',
    });
  });
});
