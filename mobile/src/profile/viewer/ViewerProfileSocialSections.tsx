import React, {
  Suspense,
  useReducer,
  useRef,
  type PropsWithChildren,
} from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';

import type { ViewerProfileSocialSectionsQuery } from '../../__generated__/ViewerProfileSocialSectionsQuery.graphql';
import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { ScreenState } from '../../components/ScreenState';
import { PRIVACY_SENSITIVE_FETCH_OPTIONS } from '../../relay/privacySensitiveFetch';
import { readConnectionNodes } from '../../relay/readConnectionNodes';
import {
  PendingRequestPreviewList,
  ProfilePreviewList,
} from '../components/ProfilePreviewList';
import { SectionHeading, SummaryStat } from '../components/ProfileCards';
import { profileScreenStyles as styles } from '../components/profileScreenStyles';
import {
  createFollowRequestState,
  followRequestReducer,
  isFollowRequestDismissed,
  type FollowRequestActionKind,
  type FollowRequestState,
} from '../followRequestReducer';
import {
  countConnectionEdges,
  formatConnectionPreviewCount,
} from '../profilePresentation';
import {
  acceptFollowRequestMutation,
  declineFollowRequestMutation,
  type ProfileConnectionAcceptFollowRequestMutation,
  type ProfileConnectionDeclineFollowRequestMutation,
} from '../profileConnectionOperations';
import { formatMutationErrors } from '../privacyModeReducer';

type FollowRequestSubmissionInput = {
  readonly follower: {
    readonly id: string;
  };
  readonly id: string;
};

const viewerProfileSocialSectionsQuery = graphql`
  query ViewerProfileSocialSectionsQuery {
    viewer {
      id
      followers(first: 10) {
        pageInfo {
          hasNextPage
        }
        edges {
          node {
            id
            displayName
            email
            privacyMode
            username
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
            displayName
            email
            privacyMode
            username
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
            displayName
            email
            privacyMode
            username
          }
        }
      }
    }
  }
`;

export function ViewerProfileSocialSectionsBoundary() {
  const [queryRetryKey, retryQuery] = useReducer((key: number) => key + 1, 0);

  return (
    <ViewerProfileSocialErrorBoundary
      key={queryRetryKey}
      onRetry={retryQuery}
    >
      <Suspense
        fallback={
          <AppCard>
            <Text>Refreshing social activity...</Text>
          </AppCard>
        }
      >
        <ViewerProfileSocialSections
          fetchKey={queryRetryKey}
          key={queryRetryKey}
        />
      </Suspense>
    </ViewerProfileSocialErrorBoundary>
  );
}

type ViewerProfileSocialErrorBoundaryProps = PropsWithChildren<{
  onRetry: () => void;
}>;

type ViewerProfileSocialErrorBoundaryState = {
  hasError: boolean;
};

class ViewerProfileSocialErrorBoundary extends React.Component<
  ViewerProfileSocialErrorBoundaryProps,
  ViewerProfileSocialErrorBoundaryState
> {
  state: ViewerProfileSocialErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ViewerProfileSocialErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ScreenState
          state="error"
          message="We couldn't refresh social activity. Check your connection and try again."
          onRetry={this.props.onRetry}
        />
      );
    }

    return this.props.children;
  }
}

function ViewerProfileSocialSections({ fetchKey }: { fetchKey: number }) {
  const router = useRouter();
  const data = useLazyLoadQuery<ViewerProfileSocialSectionsQuery>(
    viewerProfileSocialSectionsQuery,
    {},
    { ...PRIVACY_SENSITIVE_FETCH_OPTIONS, fetchKey },
  );
  const viewer = data.viewer;
  const [followRequestState, dispatchFollowRequest] = useReducer(
    followRequestReducer,
    undefined,
    createFollowRequestState,
  );
  const activeFollowRequestActionRef =
    useRef<FollowRequestState['activeAction']>(null);
  const [commitAcceptFollowRequest] =
    useMutation<ProfileConnectionAcceptFollowRequestMutation>(
      acceptFollowRequestMutation,
    );
  const [commitDeclineFollowRequest] =
    useMutation<ProfileConnectionDeclineFollowRequestMutation>(
      declineFollowRequestMutation,
    );

  if (!viewer) {
    return (
      <AppCard>
        <Text>Social activity is unavailable for this session.</Text>
      </AppCard>
    );
  }

  const followers = readConnectionNodes(viewer.followers);
  const following = readConnectionNodes(viewer.following);
  const pendingRequests = readConnectionNodes(
    data.viewerPendingFollowRequests,
  ).filter(
    (request) => !isFollowRequestDismissed(followRequestState, request.id),
  );
  const visibleFollowerCount = countConnectionEdges(viewer.followers);
  const visibleFollowingCount = countConnectionEdges(viewer.following);
  const openProfile = (userId: string) => {
    router.push({ pathname: '/profiles/[id]', params: { id: userId } });
  };

  const submitFollowRequestAction = (
    request: FollowRequestSubmissionInput,
    action: FollowRequestActionKind,
  ) => {
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

  return (
    <>
      <AppCard>
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
      </AppCard>

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
    </>
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
