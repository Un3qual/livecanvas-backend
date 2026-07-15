import React, {
  Suspense,
  useCallback,
  useReducer,
  type PropsWithChildren,
} from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useLazyLoadQuery } from 'react-relay';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import type { ContentPost } from '../content/ContentPostCard';
import { ContentSection } from '../content/ContentSection';
import { applyContentPostChanges } from '../content/contentPostChanges';
import { storyHref } from '../content/story/storyNavigation';
import { usePostControls } from '../content/usePostControls';
import type { LiveSessionSummary } from '../live/components/LiveSessionSummaryCard';
import { liveSessionHref } from '../live/liveSessionNavigation';
import { useAppTheme } from '../providers/ThemeProvider';
import { readConnectionNodes } from '../relay/readConnectionNodes';
import { spacing, typography } from '../theme/tokens';
import {
  profileContentPreviewVariables,
  profileContentQuery,
  selectProfileContentConnection,
  type ProfileContentQuery,
} from './profileContentOperations';
import {
  profileContentHref,
  type ProfileContentScope,
} from './profileContentRouteParams';

type ProfileContentPreviewSectionsProps = {
  readonly profileId: string;
  readonly scope: ProfileContentScope;
};

const styles = StyleSheet.create({
  state: {
    gap: spacing.sm,
    maxWidth: 420,
    width: '100%',
  },
  stateText: typography.body,
});

/** Loads all three profile previews through one Relay request and one controls owner. */
export function ProfileContentPreviewSections(
  props: ProfileContentPreviewSectionsProps,
) {
  const [retryKey, retry] = useReducer((key: number) => key + 1, 0);
  const resetKey = `${props.profileId}:${retryKey}`;

  return (
    <ProfileContentPreviewErrorBoundary key={resetKey} onRetry={retry}>
      <Suspense fallback={<ProfileContentPreviewState message="Loading profile content..." />}>
        <ProfileContentPreviewContent
          {...props}
          key={resetKey}
          queryFetchKey={retryKey}
        />
      </Suspense>
    </ProfileContentPreviewErrorBoundary>
  );
}

function ProfileContentPreviewContent({
  profileId,
  queryFetchKey,
  scope,
}: ProfileContentPreviewSectionsProps & { readonly queryFetchKey: number }) {
  const router = useRouter();
  const data = useLazyLoadQuery<ProfileContentQuery>(
    profileContentQuery,
    profileContentPreviewVariables(profileId),
    {
      fetchKey: queryFetchKey,
      fetchPolicy: queryFetchKey === 0 ? 'store-and-network' : 'network-only',
    },
  );
  const viewerId = data.viewer?.id ?? null;
  const postControls = usePostControls({ viewerId });
  const openStory = useCallback(
    (storyId: string) => router.push(storyHref(storyId)),
    [router],
  );
  const posts = applyContentPostChanges(
    readConnectionNodes<ContentPost>(
      selectProfileContentConnection(data, 'posts'),
    ),
    postControls.changes,
  );
  const stories = applyContentPostChanges(
    readConnectionNodes<ContentPost>(
      selectProfileContentConnection(data, 'stories'),
    ),
    postControls.changes,
  );
  const replays = readConnectionNodes<LiveSessionSummary>(
    selectProfileContentConnection(data, 'replays'),
  );

  return (
    <>
      <ContentSection
        emptyMessage="No visible posts yet."
        kind="posts"
        onViewAll={() => router.push(profileContentHref(profileId, 'posts', scope))}
        postControls={postControls}
        posts={posts}
        title="Posts"
        viewerId={viewerId}
      />
      <ContentSection
        emptyMessage="No active stories yet."
        kind="stories"
        onOpenStory={openStory}
        onViewAll={() =>
          router.push(profileContentHref(profileId, 'stories', scope))
        }
        postControls={postControls}
        posts={stories}
        title="Stories"
        viewerId={viewerId}
      />
      <ContentSection
        emptyMessage="No visible replays yet."
        kind="replays"
        onOpenLiveSession={(sessionId) => router.push(liveSessionHref(sessionId))}
        onViewAll={() =>
          router.push(profileContentHref(profileId, 'replays', scope))
        }
        sessions={replays}
        title="Replays"
      />
    </>
  );
}

type ProfileContentPreviewErrorBoundaryProps = PropsWithChildren<{
  readonly onRetry: () => void;
}>;

type ProfileContentPreviewErrorBoundaryState = {
  readonly hasError: boolean;
};

class ProfileContentPreviewErrorBoundary extends React.Component<
  ProfileContentPreviewErrorBoundaryProps,
  ProfileContentPreviewErrorBoundaryState
> {
  state: ProfileContentPreviewErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ProfileContentPreviewErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <ProfileContentPreviewState
        actionLabel="Retry profile content"
        message="Could not load profile content."
        onAction={this.props.onRetry}
      />
    );
  }
}

function ProfileContentPreviewState({
  actionLabel,
  message,
  onAction,
}: {
  readonly actionLabel?: string;
  readonly message: string;
  readonly onAction?: () => void;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.state}>
      <AppCard>
        <Text style={[styles.stateText, { color: theme.colors.textMuted }]}>
          {message}
        </Text>
        {actionLabel && onAction ? (
          <AppButton
            label={actionLabel}
            onPress={onAction}
            variant="secondary"
          />
        ) : null}
      </AppCard>
    </View>
  );
}
