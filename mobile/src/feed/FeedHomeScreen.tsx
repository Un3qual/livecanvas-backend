import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
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
import { fetchQuery, useLazyLoadQuery, useRelayEnvironment } from 'react-relay';

import { AppButton } from '../components/AppButton';
import { AppHeader } from '../components/AppHeader';
import { ScreenState } from '../components/ScreenState';
import type { ContentPost } from '../content/ContentPostCard';
import {
  ContentSection,
  type ContentSectionLoadMore,
} from '../content/ContentSection';
import { applyContentPostChanges } from '../content/contentPostChanges';
import { storyHref } from '../content/story/storyNavigation';
import type { ContentRequestIdentity } from '../content/contentSurfaceTypes';
import { usePostControls } from '../content/usePostControls';
import {
  LiveSessionSummaryCard,
  type LiveSessionSummary,
} from '../live/components/LiveSessionSummaryCard';
import { liveSessionHref } from '../live/liveSessionNavigation';
import { useAppTheme } from '../providers/ThemeProvider';
import { PRIVACY_SENSITIVE_FETCH_OPTIONS } from '../relay/privacySensitiveFetch';
import { readConnectionNodes } from '../relay/readConnectionNodes';
import { spacing, typography } from '../theme/tokens';
import {
  FEED_HOME_QUERY_VARIABLES,
  feedHomeScreenQuery,
  type FeedHomeScreenQuery,
} from './feedHomeOperations';
import {
  createFeedHomePaginationState,
  feedHomePaginationReducer,
  selectFeedHomeBasePageIdentity,
  selectFeedHomeLoadMoreState,
  selectFeedHomePageInfo,
  selectFeedHomeRows,
  type FeedHomePaginationPageInfo,
  type FeedHomePaginationSection,
  type FeedHomePaginationSectionInput,
} from './feedHomePagination';

type FeedHomeAction = {
  key: 'compose' | 'host' | 'profile' | 'contacts' | 'settings' | 'diagnostics';
  label: string;
  route:
    | '/compose'
    | '/host-broadcast'
    | '/profile'
    | '/contacts'
    | '/settings'
    | '/diagnostics';
  variant: 'primary' | 'secondary';
};

type FeedHomePost = NonNullable<
  ReturnType<typeof readConnectionNodes<FeedHomePostNode>>[number]
>;
type FeedHomePostNode = ContentPost;
type FeedHomeQueryResponse = FeedHomeScreenQuery['response'];

type FeedHomeLoadMoreControl = ContentSectionLoadMore;

type FeedHomeLoadMoreRequest = ContentRequestIdentity & {
  readonly basePageIdentity: string;
  readonly id: number;
  readonly section: FeedHomePaginationSection;
};

type FeedHomeLoadMoreRequestState = Record<
  FeedHomePaginationSection,
  FeedHomeLoadMoreRequest | null
>;

type FeedHomeManualRefreshSnapshot = {
  readonly data: FeedHomeQueryResponse;
  readonly queryDataAtStart: FeedHomeQueryResponse;
};

const FEED_HOME_PAGINATION_SECTIONS = [
  'homeFeed',
  'replays',
  'stories',
] as const satisfies readonly FeedHomePaginationSection[];

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
  metadataText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
});

export function FeedHomeScreen() {
  const [queryRetryKey, retryQuery] = useReducer((key: number) => key + 1, 0);

  return (
    <FeedHomeErrorBoundary key={queryRetryKey} onRetry={retryQuery}>
      <Suspense fallback={<FeedHomeLoadingState />}>
        <FeedHomeContent fetchKey={queryRetryKey} key={queryRetryKey} />
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
      key: 'contacts',
      label: 'Find contacts',
      route: '/contacts',
      variant: 'secondary',
    },
    {
      key: 'settings',
      label: 'Settings',
      route: '/settings',
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

export function FeedHomeContent({ fetchKey = 0 }: { fetchKey?: number }) {
  const theme = useAppTheme();
  const router = useRouter();
  const relayEnvironment = useRelayEnvironment();
  const activeLoadMoreRequestRef = useRef<FeedHomeLoadMoreRequestState>({
    homeFeed: null,
    replays: null,
    stories: null,
  });
  const loadMoreRequestIdRef = useRef(0);
  const refreshRequestIdRef = useRef(0);
  const activeRefreshRequestIdRef = useRef<number | null>(null);
  const data = useLazyLoadQuery<FeedHomeScreenQuery>(
    feedHomeScreenQuery,
    FEED_HOME_QUERY_VARIABLES,
    { ...PRIVACY_SENSITIVE_FETCH_OPTIONS, fetchKey },
  );
  const [refreshedHomeData, setRefreshedHomeData] =
    useState<FeedHomeManualRefreshSnapshot | null>(null);
  const effectiveData =
    refreshedHomeData !== null && data === refreshedHomeData.queryDataAtStart
      ? refreshedHomeData.data
      : data;
  const currentSession = effectiveData.viewer?.currentLiveSession ?? null;
  const currentSessionId = currentSession?.id;
  const viewerId = effectiveData.viewer?.id ?? null;
  const postControls = usePostControls({ viewerId });
  const stories = useMemo(
    () => readConnectionNodes<FeedHomePost>(effectiveData.storyFeed),
    [effectiveData.storyFeed],
  );
  const posts = useMemo(
    () => readConnectionNodes<FeedHomePost>(effectiveData.homeFeed),
    [effectiveData.homeFeed],
  );
  const liveNowSessions = readConnectionNodes<LiveSessionSummary>(
    effectiveData.liveNow,
  ).filter((session) => session.id !== currentSessionId);
  const replaySessions = useMemo(
    () =>
      readConnectionNodes<LiveSessionSummary>(effectiveData.replayFeed),
    [effectiveData.replayFeed],
  );
  const storiesBasePageIdentity = createBasePageIdentity(stories);
  const homeFeedBasePageIdentity = createBasePageIdentity(posts);
  const replaysBasePageIdentity = createBasePageIdentity(replaySessions);
  const [paginationState, dispatchPagination] = useReducer(
    feedHomePaginationReducer,
    createFeedHomePaginationState({
      homeFeed: createSectionPageInfo(
        normalizePageInfo(effectiveData.homeFeed?.pageInfo),
        homeFeedBasePageIdentity,
        posts,
      ),
      replays: createSectionPageInfo(
        normalizePageInfo(effectiveData.replayFeed?.pageInfo),
        replaysBasePageIdentity,
        replaySessions,
      ),
      stories: createSectionPageInfo(
        normalizePageInfo(effectiveData.storyFeed?.pageInfo),
        storiesBasePageIdentity,
        stories,
      ),
    }),
  );
  const queryPageInfo = {
    homeFeed: createSectionPageInfo(
      normalizePageInfo(effectiveData.homeFeed?.pageInfo),
      homeFeedBasePageIdentity,
      posts,
    ),
    replays: createSectionPageInfo(
      normalizePageInfo(effectiveData.replayFeed?.pageInfo),
      replaysBasePageIdentity,
      replaySessions,
    ),
    stories: createSectionPageInfo(
      normalizePageInfo(effectiveData.storyFeed?.pageInfo),
      storiesBasePageIdentity,
      stories,
    ),
  };
  const queryHomeFeedEndCursor = queryPageInfo.homeFeed.endCursor;
  const queryHomeFeedHasNextPage = queryPageInfo.homeFeed.hasNextPage;
  const queryHomeFeedBasePageIdentity =
    queryPageInfo.homeFeed.basePageIdentity ?? '';
  const queryReplaysEndCursor = queryPageInfo.replays.endCursor;
  const queryReplaysHasNextPage = queryPageInfo.replays.hasNextPage;
  const queryReplaysBasePageIdentity =
    queryPageInfo.replays.basePageIdentity ?? '';
  const queryStoriesEndCursor = queryPageInfo.stories.endCursor;
  const queryStoriesHasNextPage = queryPageInfo.stories.hasNextPage;
  const queryStoriesBasePageIdentity =
    queryPageInfo.stories.basePageIdentity ?? '';

  const homeActions = createFeedHomeActions(
    shouldShowFeedHomeHostAction(currentSession),
  );
  const contentStories = selectFeedHomeRows<FeedHomePost>(
    paginationState,
    'stories',
  );
  const contentPosts = selectFeedHomeRows<FeedHomePost>(
    paginationState,
    'homeFeed',
  );
  const contentReplays = selectFeedHomeRows<LiveSessionSummary>(
    paginationState,
    'replays',
  );
  const storiesPageInfo = selectFeedHomePageInfo(paginationState, 'stories');
  const homeFeedPageInfo = selectFeedHomePageInfo(
    paginationState,
    'homeFeed',
  );
  const replayPageInfo = selectFeedHomePageInfo(paginationState, 'replays');
  const storiesLoadMoreState = selectFeedHomeLoadMoreState(
    paginationState,
    'stories',
  );
  const homeFeedLoadMoreState = selectFeedHomeLoadMoreState(
    paginationState,
    'homeFeed',
  );
  const replayLoadMoreState = selectFeedHomeLoadMoreState(
    paginationState,
    'replays',
  );
  const storiesLoadMoreControl = createLoadMoreControl({
    error: storiesLoadMoreState.error,
    isLoading: paginationState.isRefreshing || storiesLoadMoreState.isLoading,
    onLoadMore: () => loadMoreSection('stories'),
    pageInfo: storiesPageInfo,
  });
  const homeFeedLoadMoreControl = createLoadMoreControl({
    error: homeFeedLoadMoreState.error,
    isLoading: paginationState.isRefreshing || homeFeedLoadMoreState.isLoading,
    onLoadMore: () => loadMoreSection('homeFeed'),
    pageInfo: homeFeedPageInfo,
  });
  const liveNowLoadMoreControl: FeedHomeLoadMoreControl = {
    error: null,
    isLoading: false,
    onLoadMore: () => undefined,
    visible: false,
  };
  const replayLoadMoreControl = createLoadMoreControl({
    error: replayLoadMoreState.error,
    isLoading: paginationState.isRefreshing || replayLoadMoreState.isLoading,
    onLoadMore: () => loadMoreSection('replays'),
    pageInfo: replayPageInfo,
  });
  useEffect(() => {
    const syncedSections = {
      homeFeed: createSectionPageInfo(
        {
          endCursor: queryHomeFeedEndCursor,
          hasNextPage: queryHomeFeedHasNextPage,
        },
        queryHomeFeedBasePageIdentity,
        posts,
      ),
      replays: createSectionPageInfo(
        {
          endCursor: queryReplaysEndCursor,
          hasNextPage: queryReplaysHasNextPage,
        },
        queryReplaysBasePageIdentity,
        replaySessions,
      ),
      stories: createSectionPageInfo(
        {
          endCursor: queryStoriesEndCursor,
          hasNextPage: queryStoriesHasNextPage,
        },
        queryStoriesBasePageIdentity,
        stories,
      ),
    };

    clearStaleLoadMoreRequests(syncedSections);
    dispatchPagination({
      sections: syncedSections,
      type: 'query_page_info_sync',
    });
  }, [
    queryHomeFeedEndCursor,
    queryHomeFeedHasNextPage,
    queryHomeFeedBasePageIdentity,
    queryReplaysEndCursor,
    queryReplaysHasNextPage,
    queryReplaysBasePageIdentity,
    queryStoriesEndCursor,
    queryStoriesHasNextPage,
    queryStoriesBasePageIdentity,
    posts,
    replaySessions,
    stories,
  ]);

  useEffect(() => {
    if (
      refreshedHomeData !== null &&
      data !== refreshedHomeData.queryDataAtStart
    ) {
      setRefreshedHomeData(null);
    }
  }, [data, refreshedHomeData]);

  const openLiveSession = useCallback(
    (sessionId: string) => router.push(liveSessionHref(sessionId)),
    [router],
  );
  const openStory = useCallback(
    (storyId: string) => router.push(storyHref(storyId)),
    [router],
  );

  function clearActiveLoadMoreRequests() {
    // Refresh is the invalidation boundary: clearing request identities makes
    // pre-refresh load-more completions no-op without appending stale rows.
    activeLoadMoreRequestRef.current = {
      homeFeed: null,
      replays: null,
      stories: null,
    };
  }

  function clearStaleLoadMoreRequests(
    sections: Record<
      FeedHomePaginationSection,
      FeedHomePaginationSectionInput
    >,
  ) {
    let nextRequests = activeLoadMoreRequestRef.current;

    for (const section of FEED_HOME_PAGINATION_SECTIONS) {
      const request = activeLoadMoreRequestRef.current[section];
      const incomingBasePageIdentity = sections[section].basePageIdentity ?? '';

      if (
        request !== null &&
        request.basePageIdentity !== incomingBasePageIdentity
      ) {
        nextRequests =
          nextRequests === activeLoadMoreRequestRef.current
            ? { ...activeLoadMoreRequestRef.current }
            : nextRequests;
        nextRequests[section] = null;
      }
    }

    activeLoadMoreRequestRef.current = nextRequests;
  }

  async function refreshHome() {
    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;
    activeRefreshRequestIdRef.current = requestId;
    clearActiveLoadMoreRequests();
    dispatchPagination({ type: 'refresh_start' });

    try {
      const refreshedData = await fetchQuery<FeedHomeScreenQuery>(
        relayEnvironment,
        feedHomeScreenQuery,
        FEED_HOME_QUERY_VARIABLES,
        { fetchPolicy: 'network-only' },
      ).toPromise();

      if (activeRefreshRequestIdRef.current !== requestId) {
        return;
      }

      setRefreshedHomeData(
        refreshedData === null || refreshedData === undefined
          ? null
          : {
              data: refreshedData,
              queryDataAtStart: data,
            },
      );
      const refreshedPosts = readConnectionNodes<FeedHomePost>(
        refreshedData?.homeFeed,
      );
      const refreshedReplays = readConnectionNodes<LiveSessionSummary>(
        refreshedData?.replayFeed,
      );
      const refreshedStories = readConnectionNodes<FeedHomePost>(
        refreshedData?.storyFeed,
      );
      dispatchPagination({
        sections: {
          homeFeed: createSectionPageInfo(
            normalizePageInfo(refreshedData?.homeFeed?.pageInfo),
            createBasePageIdentity(refreshedPosts),
            refreshedPosts,
          ),
          replays: createSectionPageInfo(
            normalizePageInfo(refreshedData?.replayFeed?.pageInfo),
            createBasePageIdentity(refreshedReplays),
            refreshedReplays,
          ),
          stories: createSectionPageInfo(
            normalizePageInfo(refreshedData?.storyFeed?.pageInfo),
            createBasePageIdentity(refreshedStories),
            refreshedStories,
          ),
        },
        type: 'refresh_success',
      });
    } catch {
      if (activeRefreshRequestIdRef.current !== requestId) {
        return;
      }

      dispatchPagination({
        message: 'Could not refresh home.',
        type: 'refresh_error',
      });
    } finally {
      if (activeRefreshRequestIdRef.current === requestId) {
        activeRefreshRequestIdRef.current = null;
      }
    }
  }

  async function loadMoreSection(section: FeedHomePaginationSection) {
    const pageInfo = selectFeedHomePageInfo(paginationState, section);

    if (
      !pageInfo.hasNextPage ||
      pageInfo.endCursor == null ||
      activeRefreshRequestIdRef.current !== null ||
      paginationState.isRefreshing ||
      activeLoadMoreRequestRef.current[section] !== null
    ) {
      return;
    }

    const request = {
      basePageIdentity: selectFeedHomeBasePageIdentity(
        paginationState,
        section,
      ),
      cursor: pageInfo.endCursor,
      id: loadMoreRequestIdRef.current + 1,
      key: `home:${section}:${loadMoreRequestIdRef.current + 1}`,
      routeGeneration: 0,
      section,
    };
    loadMoreRequestIdRef.current = request.id;
    activeLoadMoreRequestRef.current = {
      ...activeLoadMoreRequestRef.current,
      [section]: request,
    };

    dispatchPagination({ request, section, type: 'load_more_start' });

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

      dispatchPagination({
        pageInfo: selectLoadedSectionPageInfo(pageData, section),
        request,
        rows: selectLoadedSectionRows(pageData, section),
        section,
        type: 'load_more_success',
      });
    } catch {
      if (activeLoadMoreRequestRef.current[section] !== request) {
        return;
      }

      dispatchPagination({
        message: loadMoreErrorMessage(section),
        request,
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
            onPress={() => openLiveSession(currentSession.id)}
            session={currentSession}
          />
        </FeedHomeSection>
      ) : null}

      <ContentSection
        emptyMessage="No stories are available yet."
        kind="stories"
        loadMore={storiesLoadMoreControl}
        onOpenStory={openStory}
        postControls={postControls}
        posts={applyContentPostChanges(
          contentStories,
          postControls.changes,
        )}
        title="Stories"
        viewerId={viewerId}
      />

      <ContentSection
        emptyMessage="No feed posts are available yet."
        kind="posts"
        loadMore={homeFeedLoadMoreControl}
        postControls={postControls}
        posts={applyContentPostChanges(
          contentPosts,
          postControls.changes,
        )}
        title="Home feed"
        viewerId={viewerId}
      />

      <ContentSection
        emptyMessage="No live sessions are available right now."
        kind="live"
        loadMore={liveNowLoadMoreControl}
        onOpenLiveSession={openLiveSession}
        sessions={liveNowSessions}
        title="Live now"
      />

      <ContentSection
        emptyMessage="No replays are available yet."
        kind="replays"
        loadMore={replayLoadMoreControl}
        onOpenLiveSession={openLiveSession}
        sessions={contentReplays}
        title="Replays"
      />
    </ScrollView>
  );
}

function createSectionPageInfo(
  pageInfo: FeedHomePaginationPageInfo,
  basePageIdentity: string,
  rows: ReadonlyArray<{ readonly id: string }>,
): FeedHomePaginationSectionInput {
  return { ...pageInfo, basePageIdentity, rows };
}

function createBasePageIdentity(
  nodes: readonly { readonly id: string }[],
): string {
  return JSON.stringify(nodes.map((node) => node.id));
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

function selectLoadedSectionRows(
  pageData: FeedHomeQueryResponse | null | undefined,
  section: FeedHomePaginationSection,
): ReadonlyArray<{ readonly id: string }> {
  switch (section) {
    case 'homeFeed':
      return readConnectionNodes<FeedHomePost>(pageData?.homeFeed);

    case 'replays':
      return readConnectionNodes<LiveSessionSummary>(pageData?.replayFeed);

    case 'stories':
      return readConnectionNodes<FeedHomePost>(pageData?.storyFeed);

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

function createLoadMoreControl({
  error,
  isLoading,
  onLoadMore,
  pageInfo,
}: {
  error: string | null;
  isLoading: boolean;
  onLoadMore: () => void;
  pageInfo: FeedHomePaginationPageInfo;
}): FeedHomeLoadMoreControl {
  return {
    error,
    isLoading,
    onLoadMore,
    visible: pageInfo.hasNextPage && pageInfo.endCursor !== null,
  };
}
