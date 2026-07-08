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

describe('relationshipPresentation', () => {
  test('describes public profiles with a supported follow action', () => {
    expect(
      describeRelationshipState({ isMuted: false, state: 'PUBLIC' }),
    ).toEqual({
      actionLabel: 'Follow',
      canFollow: true,
      label: 'Public profile',
      socialActions: muteAndBlockActions,
      status: 'You can follow this profile.',
    });
  });

  test('describes non-followed private profiles with a supported request action', () => {
    expect(describeRelationshipState({ isMuted: false, state: 'NONE' })).toEqual({
      actionLabel: 'Request follow',
      canFollow: true,
      label: 'Not following',
      socialActions: muteAndBlockActions,
      status: 'Send a follow request to see protected activity.',
    });
  });

  test('keeps requested profiles non-actionable', () => {
    expect(
      describeRelationshipState({ isMuted: false, state: 'REQUESTED' }),
    ).toEqual({
      actionLabel: null,
      canFollow: false,
      label: 'Request pending',
      socialActions: muteAndBlockActions,
      status: 'Your follow request is waiting for approval.',
    });
  });

  test('keeps accepted profiles non-actionable and reflects muted state', () => {
    expect(
      describeRelationshipState({ isMuted: false, state: 'ACCEPTED' }),
    ).toEqual({
      actionLabel: null,
      canFollow: false,
      label: 'Following',
      socialActions: muteAndBlockActions,
      status: 'You follow this profile.',
    });

    expect(
      describeRelationshipState({ isMuted: true, state: 'ACCEPTED' }),
    ).toEqual({
      actionLabel: null,
      canFollow: false,
      label: 'Following',
      socialActions: unmuteAndBlockActions,
      status: 'You follow this profile. Notifications are muted.',
    });
  });

  test('keeps blocked profiles non-actionable and without unblock', () => {
    expect(
      describeRelationshipState({ isMuted: false, state: 'BLOCKED' }),
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
});
