import React, {
  useEffect,
  useReducer,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { ScreenState } from '../components/ScreenState';
import { liveSessionHref } from '../live/liveSessionNavigation';
import { LiveSessionSummaryCard } from '../live/LiveSessionSummaryCard';
import { useAppTheme } from '../providers/ThemeProvider';
import { radius, spacing, typography } from '../theme/tokens';
import {
  countConnectionEdges,
  formatConnectionPreviewCount,
  formatPrivacyModeLabel,
  formatProfileIdentity,
} from './profilePresentation';
import {
  describeRelationshipState,
  type RelationshipState,
} from './relationshipPresentation';
import { formatMutationErrors } from './mutationErrors';
import type { OtherUserProfileScreenFollowUserMutation } from './__generated__/OtherUserProfileScreenFollowUserMutation.graphql';
import type { OtherUserProfileScreenQuery } from './__generated__/OtherUserProfileScreenQuery.graphql';

type OtherUserProfileData = OtherUserProfileScreenQuery['response'];
type OtherUserProfileNode = OtherUserProfileData['node'];
type OtherUserProfileUser = Extract<
  NonNullable<OtherUserProfileNode>,
  { readonly __typename: 'User' }
>;

const otherUserProfileScreenQuery = graphql`
  query OtherUserProfileScreenQuery($id: ID!) {
    node(id: $id) {
      __typename
      ... on User {
        id
        privacyMode
        currentLiveSession {
          id
          status
          visibility
          insertedAt
          startedAt
          endedAt
          host {
            id
          }
        }
        followers(first: 3) {
          pageInfo {
            hasNextPage
          }
          edges {
            node {
              id
            }
          }
        }
        following(first: 3) {
          pageInfo {
            hasNextPage
          }
          edges {
            node {
              id
            }
          }
        }
      }
    }
    relationshipState(creatorId: $id)
    isMuted(creatorId: $id)
  }
`;

const otherUserProfileScreenFollowUserMutation = graphql`
  mutation OtherUserProfileScreenFollowUserMutation($input: FollowUserInput!) {
    followUser(input: $input) {
      follow {
        id
        state
      }
      errors {
        field
        message
      }
    }
  }
`;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  backButton: {
    width: '100%',
    maxWidth: 420,
  },
  identity: {
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
  },
  summaryPanel: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sectionTitle: typography.label,
  bodyText: typography.body,
  errorText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: typography.label,
  unavailableScreen: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  unavailableBackButton: {
    marginHorizontal: spacing.lg,
  },
});

export function OtherUserProfileScreen({ id }: { id: string }) {
  const [queryRetryKey, retryQuery] = useReducer((key: number) => key + 1, 0);
  const [relationshipStateOverride, setRelationshipStateOverride] =
    useState<RelationshipState | null>(null);
  const currentProfileIdRef = useRef(id);

  currentProfileIdRef.current = id;

  useEffect(() => {
    setRelationshipStateOverride(null);
  }, [id]);

  const handleRelationshipMutationSuccess = (
    profileId: string,
    state: RelationshipState,
  ) => {
    if (currentProfileIdRef.current !== profileId) {
      return;
    }

    setRelationshipStateOverride(state);
    retryQuery();
  };

  return (
    <OtherUserProfileErrorBoundary
      key={queryRetryKey}
      onRetry={retryQuery}
    >
      <OtherUserProfileContent
        id={id}
        key={queryRetryKey}
        onRelationshipMutationSuccess={handleRelationshipMutationSuccess}
        relationshipStateOverride={relationshipStateOverride}
      />
    </OtherUserProfileErrorBoundary>
  );
}

type OtherUserProfileErrorBoundaryProps = PropsWithChildren<{
  onRetry: () => void;
}>;

type OtherUserProfileErrorBoundaryState = {
  hasError: boolean;
};

class OtherUserProfileErrorBoundary extends React.Component<
  OtherUserProfileErrorBoundaryProps,
  OtherUserProfileErrorBoundaryState
> {
  state: OtherUserProfileErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): OtherUserProfileErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ScreenState
          state="error"
          message="We couldn't load this profile. Check your connection and try again."
          onRetry={this.props.onRetry}
        />
      );
    }

    return this.props.children;
  }
}

function OtherUserProfileContent({
  id,
  onRelationshipMutationSuccess,
  relationshipStateOverride,
}: {
  id: string;
  onRelationshipMutationSuccess: (
    profileId: string,
    state: RelationshipState,
  ) => void;
  relationshipStateOverride: RelationshipState | null;
}) {
  const theme = useAppTheme();
  const router = useRouter();
  const [followError, setFollowError] = useState<string | null>(null);
  const activeFollowSubmissionRef = useRef(false);
  const [commitFollowUser, isFollowUserMutationInFlight] =
    useMutation<OtherUserProfileScreenFollowUserMutation>(
      otherUserProfileScreenFollowUserMutation,
    );
  const data = useLazyLoadQuery<OtherUserProfileScreenQuery>(
    otherUserProfileScreenQuery,
    { id },
    { fetchPolicy: 'store-and-network' },
  );

  useEffect(() => {
    activeFollowSubmissionRef.current = false;
    setFollowError(null);
  }, [id]);

  if (!isUserNode(data.node)) {
    return (
      <UnavailableProfileScreen
        message="This profile is unavailable."
        onBack={() => router.back()}
      />
    );
  }

  const user = data.node;
  const identity = formatProfileIdentity(user);
  const privacy = formatPrivacyModeLabel(user.privacyMode);
  const relationshipState = relationshipStateOverride ?? data.relationshipState;
  const relationship = describeRelationshipState({
    isMuted: data.isMuted,
    state: relationshipState,
  });
  const currentLiveSession = user.currentLiveSession ?? null;
  const followersPreviewCount = formatConnectionPreviewCount({
    hasNextPage: user.followers?.pageInfo.hasNextPage,
    visibleCount: countConnectionEdges(user.followers),
  });
  const followingPreviewCount = formatConnectionPreviewCount({
    hasNextPage: user.following?.pageInfo.hasNextPage,
    visibleCount: countConnectionEdges(user.following),
  });

  const submitFollowUser = () => {
    if (
      !relationship.canFollow ||
      isFollowUserMutationInFlight ||
      activeFollowSubmissionRef.current
    ) {
      return;
    }

    activeFollowSubmissionRef.current = true;
    setFollowError(null);
    commitFollowUser({
      variables: {
        input: {
          followedId: user.id,
        },
      },
      onCompleted: (payload) => {
        activeFollowSubmissionRef.current = false;
        const result = payload.followUser;

        if (!result?.follow || result.errors.length > 0) {
          setFollowError(formatRelationshipMutationErrors(result?.errors));
          return;
        }

        onRelationshipMutationSuccess(id, result.follow.state);
      },
      onError: () => {
        activeFollowSubmissionRef.current = false;
        setFollowError(
          'We could not update this relationship. Check your connection and try again.',
        );
      },
    });
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <AppButton
        label="Back"
        onPress={() => router.back()}
        style={styles.backButton}
        variant="secondary"
      />

      <ProfileSummaryCard identity={identity} privacy={privacy} />

      {currentLiveSession ? (
        <LiveSessionSummaryCard
          buttonLabel="Watch live"
          onPress={() => router.push(liveSessionHref(currentLiveSession.id))}
          session={currentLiveSession}
        />
      ) : null}

      <RelationshipCard
        errorMessage={followError}
        isSubmitting={isFollowUserMutationInFlight}
        onSubmit={submitFollowUser}
        relationship={relationship}
      />

      <SocialPreviewCard
        followersPreviewCount={followersPreviewCount}
        followingPreviewCount={followingPreviewCount}
      />
    </ScrollView>
  );
}

function ProfileSummaryCard({
  identity,
  privacy,
}: {
  identity: ReturnType<typeof formatProfileIdentity>;
  privacy: ReturnType<typeof formatPrivacyModeLabel>;
}) {
  const theme = useAppTheme();

  return (
    <AppCard>
      <View style={styles.identity}>
        <ProfileAvatar initials={identity.initials} />
        <AppHeader
          eyebrow="Profile"
          title={identity.title}
          subtitle={identity.subtitle}
        />
      </View>
      <View
        style={[
          styles.summaryPanel,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {privacy.label}
        </Text>
        <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
          {privacy.description}
        </Text>
      </View>
    </AppCard>
  );
}

function RelationshipCard({
  errorMessage,
  isSubmitting,
  onSubmit,
  relationship,
}: {
  errorMessage: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
  relationship: ReturnType<typeof describeRelationshipState>;
}) {
  const theme = useAppTheme();

  return (
    <AppCard>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {relationship.label}
      </Text>
      <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
        {relationship.status}
      </Text>
      {relationship.actionLabel ? (
        <AppButton
          disabled={!relationship.canFollow || isSubmitting}
          label={isSubmitting ? 'Saving...' : relationship.actionLabel}
          onPress={onSubmit}
        />
      ) : null}
      {errorMessage ? (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {errorMessage}
        </Text>
      ) : null}
    </AppCard>
  );
}

function SocialPreviewCard({
  followersPreviewCount,
  followingPreviewCount,
}: {
  followersPreviewCount: string;
  followingPreviewCount: string;
}) {
  const theme = useAppTheme();

  return (
    <AppCard>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Visible social preview
      </Text>
      <View style={styles.stats}>
        <SocialPreviewStat label="Followers" value={followersPreviewCount} />
        <SocialPreviewStat label="Following" value={followingPreviewCount} />
      </View>
    </AppCard>
  );
}

function ProfileAvatar({ initials }: { initials: string }) {
  const theme = useAppTheme();

  return (
    <View
      style={[styles.avatar, { backgroundColor: theme.colors.surfaceMuted }]}
    >
      <Text style={[styles.avatarText, { color: theme.colors.accent }]}>
        {initials}
      </Text>
    </View>
  );
}

function SocialPreviewStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.stat,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.statValue, { color: theme.colors.text }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

function UnavailableProfileScreen({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.unavailableScreen,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <AppButton
        label="Back"
        onPress={onBack}
        style={styles.unavailableBackButton}
        variant="secondary"
      />
      <ScreenState state="empty" message={message} />
    </View>
  );
}

function isUserNode(
  node: OtherUserProfileNode,
): node is OtherUserProfileUser {
  return node?.__typename === 'User';
}

function formatRelationshipMutationErrors(
  errors: Parameters<typeof formatMutationErrors>[0],
): string {
  return formatMutationErrors(errors, 'We could not update this relationship.');
}
