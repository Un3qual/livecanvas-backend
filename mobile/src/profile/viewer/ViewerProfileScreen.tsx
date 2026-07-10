import React, {
  Suspense,
  useEffect,
  useReducer,
  useRef,
  type PropsWithChildren,
} from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';

import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { ScreenState } from '../../components/ScreenState';
import { liveSessionHref } from '../../live/liveSessionNavigation';
import { LiveSessionSummaryCard } from '../../live/components/LiveSessionSummaryCard';
import { useAppTheme } from '../../providers/ThemeProvider';
import { readConnectionNodes } from '../../relay/readConnectionNodes';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { SectionHeading, SummaryStat } from '../components/ProfileCards';
import {
  PendingRequestPreviewList,
  ProfilePreviewList,
} from '../components/ProfilePreviewList';
import { profileScreenStyles as styles } from '../components/profileScreenStyles';
import {
  countConnectionEdges,
  formatConnectionPreviewCount,
  formatPrivacyModeLabel,
  formatProfileIdentity,
} from '../profilePresentation';
import {
  createPrivacyModeState,
  formatMutationErrors,
  nextPrivacyMode,
  privacyModeReducer,
} from '../privacyModeReducer';
import {
  createFollowRequestState,
  followRequestReducer,
  isFollowRequestDismissed,
  type FollowRequestActionKind,
  type FollowRequestState,
} from '../followRequestReducer';
import type { ViewerProfileScreenAcceptFollowRequestMutation } from '../../__generated__/ViewerProfileScreenAcceptFollowRequestMutation.graphql';
import type { ViewerProfileScreenDeclineFollowRequestMutation } from '../../__generated__/ViewerProfileScreenDeclineFollowRequestMutation.graphql';
import type { ViewerProfileScreenPrivacyModeMutation } from '../../__generated__/ViewerProfileScreenPrivacyModeMutation.graphql';
import type { ViewerProfileScreenQuery } from '../../__generated__/ViewerProfileScreenQuery.graphql';

type FollowRequestSubmissionInput = {
  readonly follower: {
    readonly id: string;
  };
  readonly id: string;
};

const viewerProfileScreenPrivacyModeMutation = graphql`
  mutation ViewerProfileScreenPrivacyModeMutation(
    $input: UpdateViewerPrivacyModeInput!
  ) {
    updateViewerPrivacyMode(input: $input) {
      user {
        id
        privacyMode
      }
      errors {
        field
        message
      }
    }
  }
`;

const viewerProfileScreenAcceptFollowRequestMutation = graphql`
  mutation ViewerProfileScreenAcceptFollowRequestMutation(
    $input: AcceptFollowRequestInput!
  ) {
    acceptFollowRequest(input: $input) {
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

const viewerProfileScreenDeclineFollowRequestMutation = graphql`
  mutation ViewerProfileScreenDeclineFollowRequestMutation(
    $input: DeclineFollowRequestInput!
  ) {
    declineFollowRequest(input: $input) {
      errors {
        field
        message
      }
    }
  }
`;

export function ViewerProfileScreen() {
  const [queryRetryKey, retryQuery] = useReducer((key: number) => key + 1, 0);

  return (
    <ViewerProfileErrorBoundary key={queryRetryKey} onRetry={retryQuery}>
      <Suspense
        fallback={
          <ScreenState state="loading" message="Loading your profile..." />
        }
      >
        <ViewerProfileContent key={queryRetryKey} />
      </Suspense>
    </ViewerProfileErrorBoundary>
  );
}

type ViewerProfileErrorBoundaryProps = PropsWithChildren<{
  onRetry: () => void;
}>;

type ViewerProfileErrorBoundaryState = {
  hasError: boolean;
};

class ViewerProfileErrorBoundary extends React.Component<
  ViewerProfileErrorBoundaryProps,
  ViewerProfileErrorBoundaryState
> {
  state: ViewerProfileErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ViewerProfileErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ScreenState
          state="error"
          message="We couldn't load your profile. Check your connection and try again."
          onRetry={this.props.onRetry}
        />
      );
    }

    return this.props.children;
  }
}

function ViewerProfileContent() {
  const theme = useAppTheme();
  const router = useRouter();
  const openProfile = (userId: string) => {
    router.push({ pathname: '/profiles/[id]', params: { id: userId } });
  };
  const data = useLazyLoadQuery<ViewerProfileScreenQuery>(
    graphql`
      query ViewerProfileScreenQuery {
        viewer {
          id
          email
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
          followers(first: 10) {
            pageInfo {
              hasNextPage
            }
            edges {
              node {
                id
                email
                privacyMode
              }
            }
          }
          following(first: 10) {
            pageInfo {
              hasNextPage
            }
            edges {
              node {
                id
                email
                privacyMode
              }
            }
          }
        }
        viewerPendingFollowRequests(first: 3) {
          edges {
            node {
              id
              state
              requestedAt
              follower {
                id
                email
                privacyMode
              }
            }
          }
        }
      }
    `,
    {},
    // Followers, following, and pending requesters can become hidden without
    // a local action, so cached user-bearing rows must wait for reauthorization.
    { fetchPolicy: 'network-only' },
  );

  const viewer = data.viewer;
  const [commitPrivacyMode, isPrivacyModeMutationInFlight] =
    useMutation<ViewerProfileScreenPrivacyModeMutation>(
      viewerProfileScreenPrivacyModeMutation,
    );
  const [privacyModeState, dispatchPrivacyMode] = useReducer(
    privacyModeReducer,
    viewer?.privacyMode ?? '',
    createPrivacyModeState,
  );
  const [followRequestState, dispatchFollowRequest] = useReducer(
    followRequestReducer,
    undefined,
    createFollowRequestState,
  );
  const activeFollowRequestActionRef =
    useRef<FollowRequestState['activeAction']>(null);
  const [commitAcceptFollowRequest] =
    useMutation<ViewerProfileScreenAcceptFollowRequestMutation>(
      viewerProfileScreenAcceptFollowRequestMutation,
    );
  const [commitDeclineFollowRequest] =
    useMutation<ViewerProfileScreenDeclineFollowRequestMutation>(
      viewerProfileScreenDeclineFollowRequestMutation,
    );

  useEffect(() => {
    if (viewer?.privacyMode != null) {
      dispatchPrivacyMode({ mode: viewer.privacyMode, type: 'reset' });
    }
  }, [viewer?.privacyMode]);

  function handlePrivacyModePress() {
    const requestedPrivacyMode = nextPrivacyMode(
      privacyModeState.currentMode,
    );

    if (isPrivacyModeMutationInFlight || requestedPrivacyMode == null) {
      return;
    }

    dispatchPrivacyMode({ mode: requestedPrivacyMode, type: 'submit' });

    commitPrivacyMode({
      variables: {
        input: {
          privacyMode: requestedPrivacyMode,
        },
      },
      onCompleted: (response) => {
        const result = response.updateViewerPrivacyMode;

        if (!result?.user || result.errors.length > 0) {
          dispatchPrivacyMode({
            message: formatMutationErrors(result?.errors),
            type: 'error',
          });
          return;
        }

        dispatchPrivacyMode({
          mode: result.user.privacyMode,
          type: 'success',
        });
      },
      onError: () => {
        dispatchPrivacyMode({
          message:
            'We could not update privacy mode. Check your connection and try again.',
          type: 'error',
        });
      },
    });
  }

  const submitFollowRequestAction = (
    request: FollowRequestSubmissionInput,
    action: FollowRequestActionKind,
  ) => {
    // The ref closes the same-tick gap before reducer state reflects
    // activeAction, so rapid taps cannot start duplicate mutations.
    if (
      followRequestState.activeAction ||
      activeFollowRequestActionRef.current
    ) {
      return;
    }

    const activeAction = { action, requestId: request.id };
    activeFollowRequestActionRef.current = activeAction;
    dispatchFollowRequest({ ...activeAction, type: 'start' });

    const variables = { input: { followerId: request.follower.id } };
    const dispatchActionError = (message: string) => {
      activeFollowRequestActionRef.current = null;
      dispatchFollowRequest({
        message,
        requestId: request.id,
        type: 'error',
      });
    };
    const dispatchActionSuccess = () => {
      activeFollowRequestActionRef.current = null;
      dispatchFollowRequest({ requestId: request.id, type: 'success' });
    };
    const handleError = () => {
      dispatchActionError(
        'We could not update this follow request. Check your connection and try again.',
      );
    };

    if (action === 'accept') {
      commitAcceptFollowRequest({
        variables,
        onCompleted: (payload) => {
          const result = payload.acceptFollowRequest;

          if (!result?.follow || result.errors.length > 0) {
            dispatchActionError(
              formatFollowRequestMutationErrors(result?.errors),
            );
            return;
          }

          dispatchActionSuccess();
        },
        onError: handleError,
      });
      return;
    }

    commitDeclineFollowRequest({
      variables,
      onCompleted: (payload) => {
        const result = payload.declineFollowRequest;

        if (!result || result.errors.length > 0) {
          dispatchActionError(formatFollowRequestMutationErrors(result?.errors));
          return;
        }

        dispatchActionSuccess();
      },
      onError: handleError,
    });
  };

  if (!viewer) {
    return (
      <ScreenState
        state="empty"
        message="Profile data is unavailable for this session."
      />
    );
  }

  const identity = formatProfileIdentity(viewer);
  const displayedPrivacyMode =
    privacyModeState.pendingMode ??
    privacyModeState.currentMode ??
    viewer.privacyMode;
  const requestedPrivacyMode = nextPrivacyMode(
    privacyModeState.currentMode,
  );
  const privacy = formatPrivacyModeLabel(displayedPrivacyMode);
  const privacyButtonLabel = isPrivacyModeMutationInFlight
    ? 'Saving...'
    : requestedPrivacyMode === 'PRIVATE'
      ? 'Switch to private'
      : requestedPrivacyMode === 'PUBLIC'
        ? 'Switch to public'
        : 'Privacy unavailable';
  const followers = readConnectionNodes(viewer.followers);
  const following = readConnectionNodes(viewer.following);
  const currentLiveSession = viewer.currentLiveSession ?? null;
  const pendingRequests = readConnectionNodes(
    data.viewerPendingFollowRequests,
  ).filter(
    (request) => !isFollowRequestDismissed(followRequestState, request.id),
  );
  const visibleFollowerCount = countConnectionEdges(viewer.followers);
  const visibleFollowingCount = countConnectionEdges(viewer.following);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <AppCard>
        <View style={styles.identity}>
          <ProfileAvatar initials={identity.initials} />
          <AppHeader
            eyebrow="Profile"
            title={identity.title}
            subtitle={identity.subtitle}
          />
        </View>
        <View style={styles.stats}>
          <SummaryStat
            label="Followers preview"
            value={formatConnectionPreviewCount({
              hasNextPage: viewer.followers?.pageInfo.hasNextPage,
              visibleCount: visibleFollowerCount,
            })}
          />
          <SummaryStat
            label="Following preview"
            value={formatConnectionPreviewCount({
              hasNextPage: viewer.following?.pageInfo.hasNextPage,
              visibleCount: visibleFollowingCount,
            })}
          />
        </View>
        <View
          style={[
            styles.privacyPanel,
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
          <AppButton
            disabled={
              isPrivacyModeMutationInFlight || requestedPrivacyMode == null
            }
            label={privacyButtonLabel}
            onPress={handlePrivacyModePress}
            variant="secondary"
          />
          {privacyModeState.errorMessage ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {privacyModeState.errorMessage}
            </Text>
          ) : null}
        </View>
      </AppCard>

      {currentLiveSession ? (
        <LiveSessionSummaryCard
          buttonLabel="Open live session"
          onPress={() => router.push(liveSessionHref(currentLiveSession.id))}
          session={currentLiveSession}
        />
      ) : null}

      <AppCard>
        <SectionHeading
          title="Followers"
          subtitle={`${followers.length} visible in preview`}
        />
        <AppButton
          label="View all followers"
          onPress={() => router.push('/profile/followers')}
          variant="secondary"
        />
        <ProfilePreviewList
          users={followers}
          emptyMessage="No followers are visible yet."
          onOpenProfile={openProfile}
        />
      </AppCard>

      <AppCard>
        <SectionHeading
          title="Following"
          subtitle={`${following.length} visible in preview`}
        />
        <AppButton
          label="View all following"
          onPress={() => router.push('/profile/following')}
          variant="secondary"
        />
        <ProfilePreviewList
          users={following}
          emptyMessage="No followed profiles are visible yet."
          onOpenProfile={openProfile}
        />
      </AppCard>

      <AppCard>
        <SectionHeading
          title="Requests"
          subtitle={`${pendingRequests.length} pending in preview`}
        />
        <AppButton
          label="View requests"
          onPress={() => router.push('/profile/requests')}
          variant="secondary"
        />
        <PendingRequestPreviewList
          activeAction={followRequestState.activeAction}
          errorsByRequestId={followRequestState.errorsByRequestId}
          onAction={submitFollowRequestAction}
          onOpenProfile={openProfile}
          requests={pendingRequests}
        />
      </AppCard>
    </ScrollView>
  );
}

function formatFollowRequestMutationErrors(
  errors: Parameters<typeof formatMutationErrors>[0],
): string {
  if (!errors || errors.length === 0) {
    return 'We could not update this follow request. Check your connection and try again.';
  }

  return formatMutationErrors(errors);
}
