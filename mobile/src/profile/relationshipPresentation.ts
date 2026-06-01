export type RelationshipState =
  | 'ACCEPTED'
  | 'BLOCKED'
  | 'NONE'
  | 'PUBLIC'
  | 'REQUESTED'
  | '%future added value';

export type RelationshipDescription = {
  actionLabel: string | null;
  canFollow: boolean;
  label: string;
  status: string;
};

export function describeRelationshipState({
  isMuted,
  state,
}: {
  isMuted: boolean;
  state: RelationshipState;
}): RelationshipDescription {
  switch (state) {
    case 'PUBLIC':
      return {
        actionLabel: 'Follow',
        canFollow: true,
        label: 'Public profile',
        status: 'You can follow this profile.',
      };

    case 'NONE':
      return {
        actionLabel: 'Request follow',
        canFollow: true,
        label: 'Not following',
        status: 'Send a follow request to see protected activity.',
      };

    case 'REQUESTED':
      return {
        actionLabel: null,
        canFollow: false,
        label: 'Request pending',
        status: 'Your follow request is waiting for approval.',
      };

    // The current backend contract exposes follow/request actions but no unfollow mutation.
    case 'ACCEPTED':
      return {
        actionLabel: null,
        canFollow: false,
        label: 'Following',
        status: isMuted
          ? 'You follow this profile. Notifications are muted.'
          : 'You follow this profile.',
      };

    case 'BLOCKED':
      return {
        actionLabel: null,
        canFollow: false,
        label: 'Unavailable',
        status: 'This profile is not available.',
      };

    case '%future added value':
      return {
        actionLabel: null,
        canFollow: false,
        label: 'Relationship unavailable',
        status: 'Refresh later to see the current relationship.',
      };
  }
}
