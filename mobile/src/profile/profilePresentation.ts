type ProfileIdentityInput = {
  id: string;
  email?: string | null;
};

type ProfileIdentity = {
  title: string;
  subtitle: string;
  initials: string;
};

type PrivacyModeLabel = {
  label: string;
  description: string;
};

type FollowRequestPreviewInput = {
  state: string;
  requestedAt: string;
};

type FollowRequestPreview = {
  stateLabel: string;
  requestedAtLabel: string;
};

type NullableConnection = {
  edges?: ReadonlyArray<{ node?: unknown | null } | null | undefined> | null;
} | null | undefined;

export function formatProfileIdentity(
  input: ProfileIdentityInput,
): ProfileIdentity {
  const email = input.email?.trim();

  if (email) {
    return {
      title: email,
      subtitle: 'Signed in with email',
      initials: email.charAt(0).toUpperCase(),
    };
  }

  return {
    title: 'LiveCanvas user',
    subtitle: `Profile ID ${input.id.slice(0, 8)}`,
    initials: 'LC',
  };
}

export function formatPrivacyModeLabel(mode: string): PrivacyModeLabel {
  switch (mode) {
    case 'PUBLIC':
      return {
        label: 'Public profile',
        description:
          'People can discover your profile and request to follow you.',
      };

    case 'PRIVATE':
      return {
        label: 'Private profile',
        description:
          'New followers need approval before they can see protected activity.',
      };

    default:
      return {
        label: 'Privacy mode unavailable',
        description:
          'Refresh later to see the current profile privacy setting.',
      };
  }
}

export function countConnectionEdges(connection: NullableConnection): number {
  return (
    connection?.edges?.filter((edge) => edge?.node != null).length ?? 0
  );
}

export function formatFollowRequestPreview(
  input: FollowRequestPreviewInput,
): FollowRequestPreview {
  return {
    stateLabel: formatFollowRequestState(input.state),
    requestedAtLabel: formatRequestedAt(input.requestedAt),
  };
}

function formatFollowRequestState(state: string): string {
  switch (state) {
    case 'REQUESTED':
      return 'Requested';

    case 'ACCEPTED':
      return 'Accepted';

    default:
      return 'Pending';
  }
}

function formatRequestedAt(value: string): string {
  const requestedAt = new Date(value);

  if (Number.isNaN(requestedAt.getTime())) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(requestedAt);
}
