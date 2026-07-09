export type RelationshipState =
  | 'ACCEPTED'
  | 'BLOCKED'
  | 'NONE'
  | 'PUBLIC'
  | 'REQUESTED'
  | '%future added value';

export type RelationshipActionKind = 'block' | 'follow' | 'mute' | 'unmute';

export type RelationshipAction = {
  destructive: boolean;
  kind: RelationshipActionKind;
  label: string;
};

export type RelationshipDescription = {
  actionLabel: string | null;
  canFollow: boolean;
  label: string;
  socialActions: ReadonlyArray<RelationshipAction>;
  status: string;
};

const unavailableRelationshipDescription: RelationshipDescription = {
  actionLabel: null,
  canFollow: false,
  label: 'Relationship unavailable',
  socialActions: [],
  status: 'Refresh later to see the current relationship.',
};

export function describeRelationshipState({
  isMuted,
  isSelf = false,
  state,
}: {
  isMuted: boolean;
  isSelf?: boolean;
  state: RelationshipState;
}): RelationshipDescription {
  if (isSelf) {
    return {
      actionLabel: null,
      canFollow: false,
      label: 'Your profile',
      socialActions: [],
      status: 'This is your profile.',
    };
  }

  const socialActions = relationshipSocialActions({ isBlocked: state === 'BLOCKED', isMuted });

  switch (state) {
    case 'PUBLIC':
      return {
        actionLabel: 'Follow',
        canFollow: true,
        label: 'Public profile',
        socialActions,
        status: 'You can follow this profile.',
      };

    case 'NONE':
      return {
        actionLabel: 'Request follow',
        canFollow: true,
        label: 'Not following',
        socialActions,
        status: 'Send a follow request to see protected activity.',
      };

    case 'REQUESTED':
      return {
        actionLabel: null,
        canFollow: false,
        label: 'Request pending',
        socialActions,
        status: 'Your follow request is waiting for approval.',
      };

    // The current backend contract exposes follow/request actions but no unfollow mutation.
    case 'ACCEPTED':
      return {
        actionLabel: null,
        canFollow: false,
        label: 'Following',
        socialActions,
        status: isMuted
          ? 'You follow this profile. Notifications are muted.'
          : 'You follow this profile.',
      };

    case 'BLOCKED':
      return {
        actionLabel: null,
        canFollow: false,
        label: 'Unavailable',
        socialActions,
        status: 'This profile is not available.',
      };

    case '%future added value':
      return unavailableRelationshipDescription;

    default:
      return unavailableRelationshipDescription;
  }
}

function relationshipSocialActions({
  isBlocked,
  isMuted,
}: {
  isBlocked: boolean;
  isMuted: boolean;
}): ReadonlyArray<RelationshipAction> {
  if (isBlocked) {
    return [];
  }

  return [
    {
      destructive: false,
      kind: isMuted ? 'unmute' : 'mute',
      label: isMuted ? 'Unmute' : 'Mute',
    },
    {
      destructive: true,
      kind: 'block',
      label: 'Block',
    },
  ];
}
