import React, {
  useEffect,
  useReducer,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';

import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { ScreenState } from '../../components/ScreenState';
import { liveSessionHref } from '../../live/liveSessionNavigation';
import { LiveSessionSummaryCard } from '../../live/components/LiveSessionSummaryCard';
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
  type RelationshipActionKind,
  type RelationshipState,
} from '../relationshipPresentation';
import { formatMutationErrors } from '../mutationErrors';
import {
  socialControlBlockUserMutation,
  socialControlMuteUserMutation,
  socialControlUnmuteUserMutation,
} from '../socialControlOperations';
import {
  otherUserProfileScreenResetKey,
  selectActiveRelationshipStateOverride,
  type RelationshipStateOverride,
} from './otherUserProfileRouteState';
import type { OtherUserProfileScreenFollowUserMutation } from '../../__generated__/OtherUserProfileScreenFollowUserMutation.graphql';
import type { OtherUserProfileScreenQuery } from '../../__generated__/OtherUserProfileScreenQuery.graphql';
import type { socialControlOperationsBlockUserMutation } from '../../__generated__/socialControlOperationsBlockUserMutation.graphql';
import type { socialControlOperationsMuteUserMutation } from '../../__generated__/socialControlOperationsMuteUserMutation.graphql';
import type { socialControlOperationsUnmuteUserMutation } from '../../__generated__/socialControlOperationsUnmuteUserMutation.graphql';

type OtherUserProfileData = OtherUserProfileScreenQuery['response'];
type OtherUserProfileNode = OtherUserProfileData['node'];
type OtherUserProfileUser = Extract<
  NonNullable<OtherUserProfileNode>,
  { readonly __typename: 'User' }
>;
type SocialControlMutationResult = {
  readonly errors: ReadonlyArray<{
    readonly field?: string | null;
    readonly message: string;
  }>;
};

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
    useState<RelationshipStateOverride | null>(null);
  const currentProfileIdRef = useRef(id);
  const resetKey = otherUserProfileScreenResetKey(id, queryRetryKey);

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

    // Keep confirmed relationship state in the parent while the keyed remount
    // forces a fresh query, preventing a stale cached relationship flash.
    setRelationshipStateOverride({ profileId, state });
    retryQuery();
  };

  return (
    <OtherUserProfileErrorBoundary
      key={resetKey}
      onRetry={retryQuery}
    >
      <OtherUserProfileContent
        id={id}
        key={resetKey}
        onRelationshipMutationSuccess={handleRelationshipMutationSuccess}
        relationshipStateOverride={selectActiveRelationshipStateOverride(
          relationshipStateOverride,
          id,
        )}
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
  const [relationshipError, setRelationshipError] = useState<string | null>(null);
  const [activeRelationshipAction, setActiveRelationshipAction] =
    useState<RelationshipActionKind | null>(null);
  const [blockConfirmationVisible, setBlockConfirmationVisible] =
    useState(false);
  const [isMutedOverride, setIsMutedOverride] = useState<boolean | null>(null);
  const activeRelationshipActionRef = useRef<RelationshipActionKind | null>(null);
  const [commitFollowUser, isFollowUserMutationInFlight] =
    useMutation<OtherUserProfileScreenFollowUserMutation>(
      otherUserProfileScreenFollowUserMutation,
    );
  const [commitMuteUser, isMuteUserMutationInFlight] =
    useMutation<socialControlOperationsMuteUserMutation>(
      socialControlMuteUserMutation,
    );
  const [commitUnmuteUser, isUnmuteUserMutationInFlight] =
    useMutation<socialControlOperationsUnmuteUserMutation>(
      socialControlUnmuteUserMutation,
    );
  const [commitBlockUser, isBlockUserMutationInFlight] =
    useMutation<socialControlOperationsBlockUserMutation>(
      socialControlBlockUserMutation,
    );
  const data = useLazyLoadQuery<OtherUserProfileScreenQuery>(
    otherUserProfileScreenQuery,
    { id },
    { fetchPolicy: 'store-and-network' },
  );

  useEffect(() => {
    activeRelationshipActionRef.current = null;
    setActiveRelationshipAction(null);
    setBlockConfirmationVisible(false);
    setIsMutedOverride(null);
    setRelationshipError(null);
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
  const isMuted = isMutedOverride ?? data.isMuted;
  const relationship = describeRelationshipState({
    isMuted,
    state: relationshipState,
  });
  const isRelationshipActionInFlight =
    activeRelationshipAction !== null ||
    isFollowUserMutationInFlight ||
    isMuteUserMutationInFlight ||
    isUnmuteUserMutationInFlight ||
    isBlockUserMutationInFlight;
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
      isRelationshipActionInFlight ||
      activeRelationshipActionRef.current !== null
    ) {
      return;
    }

    activeRelationshipActionRef.current = 'follow';
    setActiveRelationshipAction('follow');
    setBlockConfirmationVisible(false);
    setRelationshipError(null);
    commitFollowUser({
      variables: {
        input: {
          followedId: user.id,
        },
      },
      onCompleted: (payload) => {
        activeRelationshipActionRef.current = null;
        setActiveRelationshipAction(null);
        const result = payload.followUser;

        if (!result?.follow || result.errors.length > 0) {
          setRelationshipError(formatRelationshipMutationErrors(result?.errors));
          return;
        }

        onRelationshipMutationSuccess(id, result.follow.state);
      },
      onError: () => {
        activeRelationshipActionRef.current = null;
        setActiveRelationshipAction(null);
        setRelationshipError(
          'We could not update this relationship. Check your connection and try again.',
        );
      },
    });
  };

  const requestSocialControl = (action: RelationshipActionKind) => {
    if (action === 'follow') {
      submitFollowUser();
      return;
    }

    if (
      isRelationshipActionInFlight ||
      activeRelationshipActionRef.current !== null
    ) {
      return;
    }

    setRelationshipError(null);

    if (action === 'block') {
      setBlockConfirmationVisible(true);
      return;
    }

    setBlockConfirmationVisible(false);
    commitSocialControl(action);
  };

  const confirmBlockUser = () => {
    if (
      !blockConfirmationVisible ||
      isRelationshipActionInFlight ||
      activeRelationshipActionRef.current !== null
    ) {
      return;
    }

    commitSocialControl('block');
  };

  const cancelBlockConfirmation = () => {
    if (activeRelationshipActionRef.current === 'block') {
      return;
    }

    setBlockConfirmationVisible(false);
  };

  function commitSocialControl(
    action: Exclude<RelationshipActionKind, 'follow'>,
  ) {
    activeRelationshipActionRef.current = action;
    setActiveRelationshipAction(action);
    setRelationshipError(null);

    switch (action) {
      case 'mute':
        commitMuteUser({
          variables: { input: { mutedId: user.id } },
          onCompleted: (payload) => {
            completeSocialControl('mute', payload.muteUser);
          },
          onError: failSocialControl,
        });
        return;

      case 'unmute':
        commitUnmuteUser({
          variables: { input: { mutedId: user.id } },
          onCompleted: (payload) => {
            completeSocialControl('unmute', payload.unmuteUser);
          },
          onError: failSocialControl,
        });
        return;

      case 'block':
        commitBlockUser({
          variables: { input: { blockedId: user.id } },
          onCompleted: (payload) => {
            completeSocialControl('block', payload.blockUser);
          },
          onError: failSocialControl,
        });
        return;

      default:
        activeRelationshipActionRef.current = null;
        setActiveRelationshipAction(null);
    }
  }

  function completeSocialControl(
    action: Exclude<RelationshipActionKind, 'follow'>,
    result: SocialControlMutationResult | null | undefined,
  ) {
    activeRelationshipActionRef.current = null;
    setActiveRelationshipAction(null);

    if (!result || result.errors.length > 0) {
      setRelationshipError(formatRelationshipMutationErrors(result?.errors));
      return;
    }

    setBlockConfirmationVisible(false);

    if (action === 'mute') {
      setIsMutedOverride(true);
      return;
    }

    if (action === 'unmute') {
      setIsMutedOverride(false);
      return;
    }

    onRelationshipMutationSuccess(id, 'BLOCKED');
  }

  function failSocialControl() {
    activeRelationshipActionRef.current = null;
    setActiveRelationshipAction(null);
    setRelationshipError(formatRelationshipMutationErrors(null));
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentInsetAdjustmentBehavior="automatic"
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
        activeSocialAction={
          activeRelationshipAction === 'follow' ? null : activeRelationshipAction
        }
        blockConfirmationVisible={blockConfirmationVisible}
        errorMessage={relationshipError}
        isSubmitting={isRelationshipActionInFlight}
        onCancelBlock={cancelBlockConfirmation}
        onConfirmBlock={confirmBlockUser}
        onFollow={submitFollowUser}
        onSocialAction={requestSocialControl}
        relationship={relationship}
      />

      <SocialPreviewCard
        followersPreviewCount={followersPreviewCount}
        followingPreviewCount={followingPreviewCount}
        onOpenFollowers={() =>
          router.push({
            params: { id: user.id },
            pathname: '/profiles/[id]/followers',
          })
        }
        onOpenFollowing={() =>
          router.push({
            params: { id: user.id },
            pathname: '/profiles/[id]/following',
          })
        }
      />
    </ScrollView>
  );
}

function RelationshipCard({
  activeSocialAction,
  blockConfirmationVisible,
  errorMessage,
  isSubmitting,
  onCancelBlock,
  onConfirmBlock,
  onFollow,
  onSocialAction,
  relationship,
}: {
  activeSocialAction: RelationshipActionKind | null;
  blockConfirmationVisible: boolean;
  errorMessage: string | null;
  isSubmitting: boolean;
  onCancelBlock: () => void;
  onConfirmBlock: () => void;
  onFollow: () => void;
  onSocialAction: (action: RelationshipActionKind) => void;
  relationship: ReturnType<typeof describeRelationshipState>;
}) {
  const theme = useAppTheme();
  const isBlocking = activeSocialAction === 'block';

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
          onPress={onFollow}
        />
      ) : null}
      {blockConfirmationVisible ? (
        <View style={styles.summaryPanel}>
          <Text style={[styles.bodyText, { color: theme.colors.text }]}>
            Block this profile? Unblock is not available in the mobile app yet.
          </Text>
          <View style={styles.rowActions}>
            <AppButton
              disabled={isSubmitting}
              label={isBlocking ? 'Blocking...' : 'Confirm block'}
              onPress={onConfirmBlock}
              style={styles.rowActionButton}
            />
            <AppButton
              disabled={isSubmitting}
              label="Cancel"
              onPress={onCancelBlock}
              style={styles.rowActionButton}
              variant="secondary"
            />
          </View>
        </View>
      ) : relationship.socialActions.length > 0 ? (
        <View style={styles.rowActions}>
          {relationship.socialActions.map((action) => (
            <AppButton
              disabled={isSubmitting}
              key={action.kind}
              label={
                activeSocialAction === action.kind ? 'Saving...' : action.label
              }
              onPress={() => onSocialAction(action.kind)}
              style={styles.rowActionButton}
              variant="secondary"
            />
          ))}
        </View>
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
