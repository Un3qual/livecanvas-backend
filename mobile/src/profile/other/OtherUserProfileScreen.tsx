import React, {
  useEffect,
  useReducer,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';

import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { ScreenState } from '../../components/ScreenState';
import { liveSessionHref } from '../../live/liveSessionNavigation';
import { LiveSessionSummaryCard } from '../../live/LiveSessionSummaryCard';
import { useAppTheme } from '../../providers/ThemeProvider';
import {
  ProfileSummaryCard,
  SocialPreviewCard,
  UnavailableProfileScreen,
} from '../components/ProfileCards';
import { profileScreenStyles as styles } from '../components/profileScreenStyles';
import {
  countConnectionEdges,
  formatConnectionPreviewCount,
  formatPrivacyModeLabel,
  formatProfileIdentity,
} from '../profilePresentation';
import {
  describeRelationshipState,
  type RelationshipState,
} from '../relationshipPresentation';
import { formatMutationErrors } from '../mutationErrors';
import type { OtherUserProfileScreenFollowUserMutation } from '../../__generated__/OtherUserProfileScreenFollowUserMutation.graphql';
import type { OtherUserProfileScreenQuery } from '../../__generated__/OtherUserProfileScreenQuery.graphql';

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
            email
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
