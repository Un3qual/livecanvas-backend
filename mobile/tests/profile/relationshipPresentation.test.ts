import { describe, expect, test } from 'bun:test';

import { describeRelationshipState } from '../../src/profile/relationshipPresentation';

describe('relationshipPresentation', () => {
  test('describes public profiles with a supported follow action', () => {
    expect(
      describeRelationshipState({ isMuted: false, state: 'PUBLIC' }),
    ).toEqual({
      actionLabel: 'Follow',
      canFollow: true,
      label: 'Public profile',
      status: 'You can follow this profile.',
    });
  });

  test('describes non-followed private profiles with a supported request action', () => {
    expect(describeRelationshipState({ isMuted: false, state: 'NONE' })).toEqual({
      actionLabel: 'Request follow',
      canFollow: true,
      label: 'Not following',
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
      status: 'You follow this profile.',
    });

    expect(
      describeRelationshipState({ isMuted: true, state: 'ACCEPTED' }),
    ).toEqual({
      actionLabel: null,
      canFollow: false,
      label: 'Following',
      status: 'You follow this profile. Notifications are muted.',
    });
  });

  test('keeps blocked profiles non-actionable', () => {
    expect(
      describeRelationshipState({ isMuted: false, state: 'BLOCKED' }),
    ).toEqual({
      actionLabel: null,
      canFollow: false,
      label: 'Unavailable',
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
      status: 'Refresh later to see the current relationship.',
    });
  });
});
