import React, {
  Suspense,
  useEffect,
  useReducer,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useRouter } from 'expo-router';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  fetchQuery,
  useLazyLoadQuery,
  useMutation,
  useRelayEnvironment,
} from 'react-relay';

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
import {
  FEED_HOME_QUERY_VARIABLES,
  feedHomeScreenQuery,
  feedHomeScreenReportPostMutation,
  type FeedHomeScreenQuery,
  type FeedHomeScreenReportPostMutation,
} from './feedHomeOperations';
import {
  createFeedHomePaginationState,
  feedHomePaginationReducer,
  selectFeedHomePageInfo,
  type FeedHomePaginationPageInfo,
  type FeedHomePaginationSection,
} from './feedHomePagination';
import {
  DEFAULT_REPORT_POST_REASON,
  canSubmitPostReport,
  createReportPostState,
  formatReportPostMutationErrors,
  isPostReportConfirmed,
  reportPostReducer,
  type ReportPostState,
} from './reportPostReducer';

type FeedHomeAction = {
  key: 'compose' | 'host' | 'profile' | 'diagnostics';
  label: string;
  route: '/compose' | '/host-broadcast' | '/profile' | '/diagnostics';
  variant: 'primary' | 'secondary';
};

type FeedHomePost = NonNullable<
  ReturnType<typeof readConnectionNodes<FeedHomePostNode>>[number]
>;
type FeedHomePostNode = FeedPostCardInput;
type FeedHomeQueryResponse = FeedHomeScreenQuery['response'];

type FeedHomeLoadMoreControl =
  | {
      readonly visible: false;
    }
  | {
      readonly error: string | null;
      readonly isLoading: boolean;
      readonly label: string;
      readonly onLoadMore: () => void;
      readonly visible: true;
    };

type FeedHomeLoadMoreRequest = {
  readonly cursor: string;
  readonly id: number;
  readonly section: FeedHomePaginationSection;
};

type FeedHomeLoadMoreRequestState = Record<
  FeedHomePaginationSection,
  FeedHomeLoadMoreRequest | null
>;

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
  reportPanel: {
    gap: spacing.xs,
  },
  loadMorePanel: {
    gap: spacing.xs,
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
    {
      key: 'compose',
      label: 'Create post',
      route: '/compose',
      variant: 'primary',
    },
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
  const relayEnvironment = useRelayEnvironment();
  const [reportPostState, dispatchReportPost] = useReducer(
    reportPostReducer,
    createReportPostState(),
  );
  // The ref closes the duplicate-tap gap before React commits reducer state.
  // After a rerender, reportPostState is the committed source of truth.
  const activeReportPostIdRef = useRef<string | null>(null);
  const [commitReportPost] = useMutation<FeedHomeScreenReportPostMutation>(
    feedHomeScreenReportPostMutation,
  );
  const activeLoadMoreRequestRef = useRef<FeedHomeLoadMoreRequestState>({
    homeFeed: null,
    replays: null,
    stories: null,
  });
  const loadMoreRequestIdRef = useRef(0);
  const data = useLazyLoadQuery<FeedHomeScreenQuery>(
    feedHomeScreenQuery,
    FEED_HOME_QUERY_VARIABLES,
    { fetchPolicy: 'store-and-network' },
  );
  const [refreshedHomeData, setRefreshedHomeData] =
    useState<FeedHomeQueryResponse | null>(null);
  const effectiveData = refreshedHomeData ?? data;
  const [paginationState, dispatchPagination] = useReducer(
    feedHomePaginationReducer,
    createFeedHomePaginationState({
      homeFeed: normalizePageInfo(effectiveData.homeFeed?.pageInfo),
      replays: normalizePageInfo(effectiveData.replayFeed?.pageInfo),
      stories: normalizePageInfo(effectiveData.storyFeed?.pageInfo),
    }),
  );
  const [olderStories, setOlderStories] = useState<FeedHomePost[]>([]);
  const [olderPosts, setOlderPosts] = useState<FeedHomePost[]>([]);
  const [olderReplays, setOlderReplays] = useState<LiveSessionSummary[]>([]);
  const queryPageInfo = {
    homeFeed: normalizePageInfo(effectiveData.homeFeed?.pageInfo),
    replays: normalizePageInfo(effectiveData.replayFeed?.pageInfo),
    stories: normalizePageInfo(effectiveData.storyFeed?.pageInfo),
  };
  const queryHomeFeedEndCursor = queryPageInfo.homeFeed.endCursor;
  const queryHomeFeedHasNextPage = queryPageInfo.homeFeed.hasNextPage;
  const queryReplaysEndCursor = queryPageInfo.replays.endCursor;
  const queryReplaysHasNextPage = queryPageInfo.replays.hasNextPage;
  const queryStoriesEndCursor = queryPageInfo.stories.endCursor;
  const queryStoriesHasNextPage = queryPageInfo.stories.hasNextPage;

  const currentSession = effectiveData.viewer?.currentLiveSession ?? null;
  const currentSessionId = currentSession?.id;
  const viewerId = effectiveData.viewer?.id ?? null;
  const homeActions = createFeedHomeActions(
    shouldShowFeedHomeHostAction(currentSession),
  );
  const stories = readConnectionNodes<FeedHomePost>(effectiveData.storyFeed);
  const posts = readConnectionNodes<FeedHomePost>(effectiveData.homeFeed);
  const liveNowSessions = readConnectionNodes<LiveSessionSummary>(
    effectiveData.liveNow,
  ).filter((session) => session.id !== currentSessionId);
  const replaySessions = readConnectionNodes<LiveSessionSummary>(
    effectiveData.replayFeed,
  );
  const storiesPageInfo = selectFeedHomePageInfo(paginationState, 'stories');
  const homeFeedPageInfo = selectFeedHomePageInfo(
    paginationState,
    'homeFeed',
  );
  const replayPageInfo = selectFeedHomePageInfo(paginationState, 'replays');
  const storiesLoadMoreControl = createLoadMoreControl({
    error: paginationState.sections.stories.error,
    isLoading: paginationState.sections.stories.isLoadingMore,
    label: 'Load more stories',
    onLoadMore: () => loadMoreSection('stories'),
    pageInfo: storiesPageInfo,
  });
  const homeFeedLoadMoreControl = createLoadMoreControl({
    error: paginationState.sections.homeFeed.error,
    isLoading: paginationState.sections.homeFeed.isLoadingMore,
    label: 'Load more feed posts',
    onLoadMore: () => loadMoreSection('homeFeed'),
    pageInfo: homeFeedPageInfo,
  });
  const liveNowLoadMoreControl: FeedHomeLoadMoreControl = { visible: false };
  const replayLoadMoreControl = createLoadMoreControl({
    error: paginationState.sections.replays.error,
    isLoading: paginationState.sections.replays.isLoadingMore,
    label: 'Load more replays',
    onLoadMore: () => loadMoreSection('replays'),
    pageInfo: replayPageInfo,
  });

  useEffect(() => {
    activeLoadMoreRequestRef.current = {
      homeFeed: null,
      replays: null,
      stories: null,
    };
    dispatchPagination({
      sections: {
        homeFeed: {
          endCursor: queryHomeFeedEndCursor,
          hasNextPage: queryHomeFeedHasNextPage,
        },
        replays: {
          endCursor: queryReplaysEndCursor,
          hasNextPage: queryReplaysHasNextPage,
        },
        stories: {
          endCursor: queryStoriesEndCursor,
          hasNextPage: queryStoriesHasNextPage,
        },
      },
      type: 'query_page_info_sync',
    });
  }, [
    queryHomeFeedEndCursor,
    queryHomeFeedHasNextPage,
    queryReplaysEndCursor,
    queryReplaysHasNextPage,
    queryStoriesEndCursor,
    queryStoriesHasNextPage,
  ]);

  function openLiveSession(session: LiveSessionSummary) {
    router.push(liveSessionHref(session.id));
  }

  function clearActiveLoadMoreRequests() {
    activeLoadMoreRequestRef.current = {
      homeFeed: null,
      replays: null,
      stories: null,
    };
  }

  async function refreshHome() {
    clearActiveLoadMoreRequests();
    dispatchPagination({ type: 'refresh_start' });

    try {
      const refreshedData = await fetchQuery<FeedHomeScreenQuery>(
        relayEnvironment,
        feedHomeScreenQuery,
        FEED_HOME_QUERY_VARIABLES,
        { fetchPolicy: 'network-only' },
      ).toPromise();

      setRefreshedHomeData(refreshedData ?? null);
      setOlderStories([]);
      setOlderPosts([]);
      setOlderReplays([]);
      dispatchPagination({
        sections: {
          homeFeed: normalizePageInfo(refreshedData?.homeFeed?.pageInfo),
          replays: normalizePageInfo(refreshedData?.replayFeed?.pageInfo),
          stories: normalizePageInfo(refreshedData?.storyFeed?.pageInfo),
        },
        type: 'refresh_success',
      });
    } catch {
      dispatchPagination({
        message: 'Could not refresh home.',
        type: 'refresh_error',
      });
    }
  }

  async function loadMoreSection(section: FeedHomePaginationSection) {
    const pageInfo = selectFeedHomePageInfo(paginationState, section);

    if (
      !pageInfo.hasNextPage ||
      pageInfo.endCursor == null ||
      activeLoadMoreRequestRef.current[section] !== null
    ) {
      return;
    }

    const request = {
      cursor: pageInfo.endCursor,
      id: loadMoreRequestIdRef.current + 1,
      section,
    };
    loadMoreRequestIdRef.current = request.id;
    activeLoadMoreRequestRef.current = {
      ...activeLoadMoreRequestRef.current,
      [section]: request,
    };

    dispatchPagination({ section, type: 'load_more_start' });

    try {
      const pageData = await fetchQuery<FeedHomeScreenQuery>(
        relayEnvironment,
        feedHomeScreenQuery,
        {
          ...FEED_HOME_QUERY_VARIABLES,
          feedAfter: section === 'homeFeed' ? pageInfo.endCursor : null,
          replayAfter: section === 'replays' ? pageInfo.endCursor : null,
          storyAfter: section === 'stories' ? pageInfo.endCursor : null,
        },
        { fetchPolicy: 'network-only' },
      ).toPromise();

      if (activeLoadMoreRequestRef.current[section] !== request) {
        return;
      }

      appendOlderSectionRows(section, pageData);
      dispatchPagination({
        pageInfo: selectLoadedSectionPageInfo(pageData, section),
        section,
        type: 'load_more_success',
      });
    } catch {
      if (activeLoadMoreRequestRef.current[section] !== request) {
        return;
      }

      dispatchPagination({
        message: loadMoreErrorMessage(section),
        section,
        type: 'load_more_error',
      });
    } finally {
      if (activeLoadMoreRequestRef.current[section] === request) {
        activeLoadMoreRequestRef.current = {
          ...activeLoadMoreRequestRef.current,
          [section]: null,
        };
      }
    }
  }

  function appendOlderSectionRows(
    section: FeedHomePaginationSection,
    pageData: FeedHomeQueryResponse | null | undefined,
  ) {
    switch (section) {
      case 'homeFeed':
        setOlderPosts((current) =>
          current.concat(readConnectionNodes(pageData?.homeFeed)),
        );
        return;

      case 'replays':
        setOlderReplays((current) =>
          current.concat(readConnectionNodes(pageData?.replayFeed)),
        );
        return;

      case 'stories':
        setOlderStories((current) =>
          current.concat(readConnectionNodes(pageData?.storyFeed)),
        );
        return;

      default:
        return assertNever(section);
    }
  }

  function reportPost(post: FeedHomePost) {
    // Check the ref for same-render duplicate taps, then reducer state for
    // committed report progress and confirmation.
    if (
      viewerId == null ||
      post.author.id === viewerId ||
      activeReportPostIdRef.current !== null ||
      !canSubmitPostReport(reportPostState, post.id)
    ) {
      return;
    }

    activeReportPostIdRef.current = post.id;
    dispatchReportPost({ postId: post.id, type: 'start' });
    commitReportPost({
      variables: {
        input: {
          details: null,
          postId: post.id,
          reason: DEFAULT_REPORT_POST_REASON,
        },
      },
      onCompleted: (payload) => {
        activeReportPostIdRef.current = null;
        const result = payload.reportPost;

        if (!result?.report || result.errors.length > 0) {
          dispatchReportPost({
            message: formatReportPostMutationErrors(result?.errors),
            postId: post.id,
            type: 'error',
          });
          return;
        }

        dispatchReportPost({ postId: post.id, type: 'success' });
      },
      onError: () => {
        activeReportPostIdRef.current = null;
        dispatchReportPost({
          message: formatReportPostMutationErrors(null),
          postId: post.id,
          type: 'error',
        });
      },
    });
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            refreshHome();
          }}
          refreshing={paginationState.isRefreshing}
        />
      }
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

      {paginationState.refreshError ? (
        <Text style={[styles.metadataText, { color: theme.colors.error }]}>
          {paginationState.refreshError}
        </Text>
      ) : null}

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
        loadMoreControl={storiesLoadMoreControl}
        onReportPost={reportPost}
        posts={stories.concat(olderStories)}
        reportPostState={reportPostState}
        title="Stories"
        viewerId={viewerId}
      />

      <PostSection
        emptyMessage="No feed posts are available yet."
        loadMoreControl={homeFeedLoadMoreControl}
        onReportPost={reportPost}
        posts={posts.concat(olderPosts)}
        reportPostState={reportPostState}
        title="Home feed"
        viewerId={viewerId}
      />

      <LiveSessionSection
        buttonLabel="Watch live"
        emptyMessage="No live sessions are available right now."
        loadMoreControl={liveNowLoadMoreControl}
        onOpen={openLiveSession}
        sessions={liveNowSessions}
        title="Live now"
      />

      <LiveSessionSection
        buttonLabel="Watch replay"
        emptyMessage="No replays are available yet."
        loadMoreControl={replayLoadMoreControl}
        onOpen={openLiveSession}
        sessions={replaySessions.concat(olderReplays)}
        title="Replays"
      />
    </ScrollView>
  );
}

function selectLoadedSectionPageInfo(
  pageData: FeedHomeQueryResponse | null | undefined,
  section: FeedHomePaginationSection,
): FeedHomePaginationPageInfo {
  switch (section) {
    case 'homeFeed':
      return normalizePageInfo(pageData?.homeFeed?.pageInfo);

    case 'replays':
      return normalizePageInfo(pageData?.replayFeed?.pageInfo);

    case 'stories':
      return normalizePageInfo(pageData?.storyFeed?.pageInfo);

    default:
      return assertNever(section);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled feed home section: ${String(value)}`);
}

function normalizePageInfo(
  pageInfo:
    | {
        readonly endCursor?: string | null;
        readonly hasNextPage?: boolean;
      }
    | null
    | undefined,
): FeedHomePaginationPageInfo {
  return {
    endCursor: pageInfo?.endCursor ?? null,
    hasNextPage: pageInfo?.hasNextPage ?? false,
  };
}

function loadMoreErrorMessage(section: FeedHomePaginationSection): string {
  switch (section) {
    case 'homeFeed':
      return 'Could not load more feed posts.';

    case 'replays':
      return 'Could not load more replays.';

    case 'stories':
      return 'Could not load more stories.';

    default:
      return assertNever(section);
  }
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
  loadMoreControl,
  onReportPost,
  posts,
  reportPostState,
  title,
  viewerId,
}: {
  emptyMessage: string;
  loadMoreControl: FeedHomeLoadMoreControl;
  onReportPost: (post: FeedHomePost) => void;
  posts: ReadonlyArray<FeedHomePost>;
  reportPostState: ReportPostState;
  title: string;
  viewerId: string | null;
}) {
  return (
    <FeedHomeSection title={title}>
      {posts.length > 0 ? (
        posts.map((post) => (
          <FeedPostCard
            key={post.id}
            onReportPost={onReportPost}
            post={post}
            reportPostState={reportPostState}
            viewerId={viewerId}
          />
        ))
      ) : (
        <EmptySectionMessage message={emptyMessage} />
      )}
      <FeedHomeLoadMoreControlView control={loadMoreControl} />
    </FeedHomeSection>
  );
}

function FeedPostCard({
  onReportPost,
  post,
  reportPostState,
  viewerId,
}: {
  onReportPost: (post: FeedHomePost) => void;
  post: FeedHomePost;
  reportPostState: ReportPostState;
  viewerId: string | null;
}) {
  const theme = useAppTheme();
  const presentation = formatPostCardPresentation(post);
  const isOwnPost = viewerId != null && post.author.id === viewerId;
  const isReportActive = reportPostState.activePostId === post.id;
  const isReportConfirmed = isPostReportConfirmed(reportPostState, post.id);
  const reportError = reportPostState.errorsByPostId[post.id] ?? null;
  const showReportAction = viewerId != null && !isOwnPost;

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

      {showReportAction ? (
        <View style={styles.reportPanel}>
          {isReportConfirmed ? (
            <Text style={[styles.metadataText, { color: theme.colors.text }]}>
              Report submitted.
            </Text>
          ) : (
            <AppButton
              disabled={isReportActive}
              label={isReportActive ? 'Reporting...' : 'Report post'}
              onPress={() => onReportPost(post)}
              variant="secondary"
            />
          )}

          {reportError ? (
            <Text style={[styles.metadataText, { color: theme.colors.error }]}>
              {reportError}
            </Text>
          ) : null}
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
  loadMoreControl,
  onOpen,
  sessions,
  title,
}: {
  buttonLabel: string;
  emptyMessage: string;
  loadMoreControl: FeedHomeLoadMoreControl;
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
      <FeedHomeLoadMoreControlView control={loadMoreControl} />
    </FeedHomeSection>
  );
}

function createLoadMoreControl({
  error,
  isLoading,
  label,
  onLoadMore,
  pageInfo,
}: {
  error: string | null;
  isLoading: boolean;
  label: string;
  onLoadMore: () => void;
  pageInfo: FeedHomePaginationPageInfo;
}): FeedHomeLoadMoreControl {
  return {
    error,
    isLoading,
    label,
    onLoadMore,
    visible: pageInfo.hasNextPage && pageInfo.endCursor !== null,
  };
}

function FeedHomeLoadMoreControlView({
  control,
}: {
  control: FeedHomeLoadMoreControl;
}) {
  const theme = useAppTheme();

  if (!control.visible) {
    return null;
  }

  return (
    <View style={styles.loadMorePanel}>
      <AppButton
        disabled={control.isLoading}
        label={control.isLoading ? 'Loading...' : control.label}
        onPress={control.onLoadMore}
        variant="secondary"
      />
      {control.error ? (
        <Text style={[styles.metadataText, { color: theme.colors.error }]}>
          {control.error}
        </Text>
      ) : null}
    </View>
  );
}
