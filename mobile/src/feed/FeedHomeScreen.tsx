import React, { Suspense, useReducer, type PropsWithChildren } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { graphql, useLazyLoadQuery } from 'react-relay';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { ScreenState } from '../components/ScreenState';
import {
  LiveSessionSummaryCard,
  type LiveSessionSummary,
} from '../live/components/LiveSessionSummaryCard';
import { liveSessionHref } from '../live/liveSessionNavigation';
import { useAppTheme } from '../providers/ThemeProvider';
import { readConnectionNodes } from '../relay/readConnectionNodes';
import { radius, spacing, typography } from '../theme/tokens';
import {
  formatPostCardPresentation,
  type FeedMediaAssetPresentation,
  type FeedPostCardInput,
} from './feedPresentation';
import type { FeedHomeScreenQuery } from '../__generated__/FeedHomeScreenQuery.graphql';

export const FEED_HOME_QUERY_VARIABLES = {
  feedFirst: 10,
  liveFirst: 20,
  replayFirst: 10,
  storyFirst: 10,
} as const;

type FeedHomeAction = {
  key: 'host' | 'profile' | 'diagnostics';
  label: string;
  route: '/host-broadcast' | '/profile' | '/diagnostics';
  variant: 'primary' | 'secondary';
};

type FeedHomePost = NonNullable<
  ReturnType<typeof readConnectionNodes<FeedHomePostNode>>[number]
>;
type FeedHomePostNode = FeedPostCardInput;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  section: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.sm,
  },
  sectionTitle: typography.label,
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  cardHeader: {
    gap: spacing.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: typography.label,
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  bodyText: typography.body,
  metadata: {
    gap: spacing.xs,
  },
  metadataText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  mediaList: {
    borderWidth: 1,
    borderRadius: radius.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
});

export function FeedHomeScreen() {
  const [queryRetryKey, retryQuery] = useReducer((key: number) => key + 1, 0);

  return (
    <FeedHomeErrorBoundary key={queryRetryKey} onRetry={retryQuery}>
      <Suspense fallback={<FeedHomeLoadingState />}>
        <FeedHomeContent key={queryRetryKey} />
      </Suspense>
    </FeedHomeErrorBoundary>
  );
}

export function FeedHomeLoadingState() {
  return <ScreenState state="loading" message="Loading home..." />;
}

export function FeedHomeQueryErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <ScreenState
      state="error"
      message="We couldn't load home. Check your connection and try again."
      onRetry={onRetry}
    />
  );
}

export function shouldShowFeedHomeHostAction(
  currentSession: Pick<LiveSessionSummary, 'id'> | null | undefined,
): boolean {
  return currentSession == null;
}

export function createFeedHomeActions(
  showHostCreationAction: boolean,
): FeedHomeAction[] {
  return [
    ...(showHostCreationAction
      ? ([
          {
            key: 'host',
            label: 'Host a live session',
            route: '/host-broadcast',
            variant: 'primary',
          },
        ] satisfies FeedHomeAction[])
      : []),
    {
      key: 'profile',
      label: 'Open profile',
      route: '/profile',
      variant: 'secondary',
    },
    {
      key: 'diagnostics',
      label: 'Diagnostics',
      route: '/diagnostics',
      variant: 'secondary',
    },
  ];
}

export function pushFeedHomeAction(
  router: { push: (route: FeedHomeAction['route']) => void },
  action: Pick<FeedHomeAction, 'route'>,
) {
  router.push(action.route);
}

export function FeedHomeContent() {
  const theme = useAppTheme();
  const router = useRouter();
  const data = useLazyLoadQuery<FeedHomeScreenQuery>(
    graphql`
      query FeedHomeScreenQuery(
        $feedFirst: Int!
        $liveFirst: Int!
        $replayFirst: Int!
        $storyFirst: Int!
      ) {
        viewer {
          id
          currentLiveSession {
            id
            channelTopic
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
        }
        storyFeed(first: $storyFirst) {
          edges {
            node {
              id
              kind
              bodyText
              visibility
              expiresAt
              insertedAt
              author {
                id
                email
              }
              mediaAssets {
                id
                mimeType
                processingState
                publicUrl
              }
            }
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
        homeFeed(first: $feedFirst) {
          edges {
            node {
              id
              kind
              bodyText
              visibility
              expiresAt
              insertedAt
              author {
                id
                email
              }
              mediaAssets {
                id
                mimeType
                processingState
                publicUrl
              }
            }
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
        liveNow(first: $liveFirst) {
          edges {
            node {
              id
              channelTopic
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
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
        replayFeed(first: $replayFirst) {
          edges {
            node {
              id
              channelTopic
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
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    `,
    FEED_HOME_QUERY_VARIABLES,
    { fetchPolicy: 'store-and-network' },
  );

  const currentSession = data.viewer?.currentLiveSession ?? null;
  const currentSessionId = currentSession?.id;
  const homeActions = createFeedHomeActions(
    shouldShowFeedHomeHostAction(currentSession),
  );
  const stories = readConnectionNodes(data.storyFeed);
  const posts = readConnectionNodes(data.homeFeed);
  const liveNowSessions = readConnectionNodes(data.liveNow).filter(
    (session) => session.id !== currentSessionId,
  );
  const replaySessions = readConnectionNodes(data.replayFeed);

  function openLiveSession(session: LiveSessionSummary) {
    router.push(liveSessionHref(session.id));
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <AppHeader
        eyebrow="Home"
        title="Home"
        subtitle="Catch up on stories, posts, live sessions, and replays."
      />

      <View style={styles.actions}>
        {homeActions.map((action) => (
          <AppButton
            key={action.key}
            label={action.label}
            onPress={() => pushFeedHomeAction(router, action)}
            variant={action.variant}
          />
        ))}
      </View>

      {currentSession ? (
        <FeedHomeSection title="Your live session">
          <LiveSessionSummaryCard
            buttonLabel="Open session"
            onPress={() => openLiveSession(currentSession)}
            session={currentSession}
          />
        </FeedHomeSection>
      ) : null}

      <PostSection
        emptyMessage="No stories are available yet."
        posts={stories}
        title="Stories"
      />

      <PostSection
        emptyMessage="No feed posts are available yet."
        posts={posts}
        title="Home feed"
      />

      <LiveSessionSection
        buttonLabel="Watch live"
        emptyMessage="No live sessions are available right now."
        onOpen={openLiveSession}
        sessions={liveNowSessions}
        title="Live now"
      />

      <LiveSessionSection
        buttonLabel="Watch replay"
        emptyMessage="No replays are available yet."
        onOpen={openLiveSession}
        sessions={replaySessions}
        title="Replays"
      />
    </ScrollView>
  );
}

type FeedHomeErrorBoundaryProps = PropsWithChildren<{
  onRetry: () => void;
}>;

type FeedHomeErrorBoundaryState = {
  hasError: boolean;
};

class FeedHomeErrorBoundary extends React.Component<
  FeedHomeErrorBoundaryProps,
  FeedHomeErrorBoundaryState
> {
  state: FeedHomeErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): FeedHomeErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <FeedHomeQueryErrorState onRetry={this.props.onRetry} />;
    }

    return this.props.children;
  }
}

function FeedHomeSection({
  children,
  title,
}: PropsWithChildren<{ title: string }>) {
  const theme = useAppTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function EmptySectionMessage({ message }: { message: string }) {
  const theme = useAppTheme();

  return (
    <AppCard>
      <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
        {message}
      </Text>
    </AppCard>
  );
}

function PostSection({
  emptyMessage,
  posts,
  title,
}: {
  emptyMessage: string;
  posts: ReadonlyArray<FeedHomePost>;
  title: string;
}) {
  return (
    <FeedHomeSection title={title}>
      {posts.length > 0 ? (
        posts.map((post) => <FeedPostCard key={post.id} post={post} />)
      ) : (
        <EmptySectionMessage message={emptyMessage} />
      )}
    </FeedHomeSection>
  );
}

function FeedPostCard({ post }: { post: FeedHomePost }) {
  const theme = useAppTheme();
  const presentation = formatPostCardPresentation(post);

  return (
    <AppCard>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.badge,
            { backgroundColor: theme.colors.surfaceMuted },
          ]}
        >
          <Text style={[styles.badgeText, { color: theme.colors.text }]}>
            {presentation.kindLabel}
          </Text>
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {presentation.author.title}
        </Text>
        <Text style={[styles.metadataText, { color: theme.colors.textMuted }]}>
          {presentation.author.subtitle}
        </Text>
      </View>

      <Text style={[styles.bodyText, { color: theme.colors.text }]}>
        {presentation.body}
      </Text>

      <View style={styles.metadata}>
        <Text style={[styles.metadataText, { color: theme.colors.textMuted }]}>
          {presentation.timestampLabel}
        </Text>
        <Text style={[styles.metadataText, { color: theme.colors.textMuted }]}>
          {presentation.visibilityLabel}
        </Text>
        {presentation.storyExpiryLabel ? (
          <Text style={[styles.metadataText, { color: theme.colors.textMuted }]}>
            {presentation.storyExpiryLabel}
          </Text>
        ) : null}
      </View>

      {presentation.mediaAssets.length > 0 ? (
        <View
          style={[
            styles.mediaList,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {presentation.mediaAssets.map((asset) => (
            <MediaAssetRow asset={asset} key={asset.id} />
          ))}
        </View>
      ) : null}
    </AppCard>
  );
}

function MediaAssetRow({
  asset,
}: {
  asset: FeedMediaAssetPresentation;
}) {
  const theme = useAppTheme();

  return (
    <View>
      <Text style={[styles.metadataText, { color: theme.colors.text }]}>
        {asset.label}
      </Text>
      <Text style={[styles.metadataText, { color: theme.colors.textMuted }]}>
        {asset.body}
      </Text>
    </View>
  );
}

function LiveSessionSection({
  buttonLabel,
  emptyMessage,
  onOpen,
  sessions,
  title,
}: {
  buttonLabel: string;
  emptyMessage: string;
  onOpen: (session: LiveSessionSummary) => void;
  sessions: ReadonlyArray<LiveSessionSummary>;
  title: string;
}) {
  return (
    <FeedHomeSection title={title}>
      {sessions.length > 0 ? (
        sessions.map((session) => (
          <LiveSessionSummaryCard
            buttonLabel={buttonLabel}
            key={session.id}
            onPress={() => onOpen(session)}
            session={session}
          />
        ))
      ) : (
        <EmptySectionMessage message={emptyMessage} />
      )}
    </FeedHomeSection>
  );
}
