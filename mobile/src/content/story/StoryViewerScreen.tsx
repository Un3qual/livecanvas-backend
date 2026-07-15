import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  fetchQuery,
  useLazyLoadQuery,
  useRelayEnvironment,
} from 'react-relay';

import { AppButton } from '../../components/AppButton';
import { AppHeader } from '../../components/AppHeader';
import { RelayRouteBoundary } from '../../components/RelayRouteBoundary';
import { ScreenState } from '../../components/ScreenState';
import { useAppTheme } from '../../providers/ThemeProvider';
import { PRIVACY_SENSITIVE_FETCH_OPTIONS } from '../../relay/privacySensitiveFetch';
import { readConnectionNodes } from '../../relay/readConnectionNodes';
import { spacing, typography } from '../../theme/tokens';
import { ContentMediaAssetView } from '../ContentMediaAssetView';
import type { ContentPost } from '../ContentPostCard';
import { formatPostCardPresentation } from '../contentPostPresentation';
import { storyHref } from './storyNavigation';
import {
  storyViewerQuery,
  type StoryViewerOperationsQuery,
} from './storyViewerOperations';
import { selectStoryViewerState } from './storyViewerState';

const STORY_VIEWER_FEED_SIZE = 100;

const styles = StyleSheet.create({
  body: typography.body,
  content: {
    alignItems: 'stretch',
    gap: spacing.lg,
    marginHorizontal: 'auto',
    maxWidth: 540,
    padding: spacing.lg,
    width: '100%',
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  mediaList: {
    gap: spacing.sm,
  },
  progress: typography.label,
  screen: {
    flex: 1,
  },
});

type StoryViewerQueryResponse = StoryViewerOperationsQuery['response'];

type StoryFeedPage = Readonly<{
  endCursor: string | null;
  hasNextPage: boolean;
  stories: ReadonlyArray<ContentPost>;
}>;

type StoryFeedLoadState = Readonly<{
  status: 'complete' | 'loading' | 'unavailable';
  stories: ReadonlyArray<ContentPost>;
}>;

export function StoryViewerScreen({ storyId }: { readonly storyId: string }) {
  return (
    <RelayRouteBoundary
      errorMessage="We could not load this story."
      loadingMessage="Loading story..."
    >
      {(queryFetchKey) => (
        <StoryViewerContent
          key={`${storyId}:${queryFetchKey}`}
          queryFetchKey={queryFetchKey}
          storyId={storyId}
        />
      )}
    </RelayRouteBoundary>
  );
}

function StoryViewerContent({
  queryFetchKey,
  storyId,
}: {
  readonly queryFetchKey: number;
  readonly storyId: string;
}) {
  const router = useRouter();
  const theme = useAppTheme();
  const relayEnvironment = useRelayEnvironment();
  const data = useLazyLoadQuery<StoryViewerOperationsQuery>(
    storyViewerQuery,
    { id: storyId, storyAfter: null, storyFirst: STORY_VIEWER_FEED_SIZE },
    { ...PRIVACY_SENSITIVE_FETCH_OPTIONS, fetchKey: queryFetchKey },
  );
  const selectedNode = data.node?.__typename === 'Post' ? data.node : null;
  const storyFeed = useCompleteStoryFeed({
    initialData: data,
    relayEnvironment,
    storyId,
  });

  if (storyFeed.status === 'loading') {
    return <ScreenState message="Loading story navigation..." state="loading" />;
  }

  const state = selectStoryViewerState({
    feedStatus:
      storyFeed.status === 'complete' ? 'complete' : 'unavailable',
    feedStories: storyFeed.stories,
    selectedStory: selectedNode,
    selectedStoryId: storyId,
  });

  if (!state.selectedStory) {
    return (
      <ScreenState
        actionLabel="Close story"
        message="This story is no longer available."
        onAction={() => router.back()}
        state="empty"
      />
    );
  }

  const presentation = formatPostCardPresentation(state.selectedStory);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.progress, { color: theme.colors.textMuted }]}>
          {state.progressLabel}
        </Text>
        <AppButton
          label="Close story"
          onPress={() => router.back()}
          variant="secondary"
        />
      </View>

      <AppHeader
        eyebrow="Story"
        subtitle={presentation.timestampLabel}
        title={presentation.author.title}
      />

      <Text style={[styles.body, { color: theme.colors.text }]}>
        {presentation.body}
      </Text>

      <View style={styles.mediaList}>
        {presentation.mediaAssets.map((asset) => (
          <ContentMediaAssetView asset={asset} key={asset.id} />
        ))}
      </View>

      <View style={styles.controls}>
        <AppButton
          disabled={state.previousStoryId == null}
          label="Previous story"
          onPress={() => openStory(router, state.previousStoryId)}
          variant="secondary"
        />
        <AppButton
          disabled={state.nextStoryId == null}
          label="Next story"
          onPress={() => openStory(router, state.nextStoryId)}
        />
      </View>
    </ScrollView>
  );
}

function openStory(
  router: ReturnType<typeof useRouter>,
  storyId: string | null,
) {
  if (storyId) {
    router.replace(storyHref(storyId));
  }
}

function useCompleteStoryFeed({
  initialData,
  relayEnvironment,
  storyId,
}: {
  readonly initialData: StoryViewerQueryResponse;
  readonly relayEnvironment: ReturnType<typeof useRelayEnvironment>;
  readonly storyId: string;
}): StoryFeedLoadState {
  const initialPageRef = useRef(readStoryFeedPage(initialData, storyId));
  const [state, setState] = useState<StoryFeedLoadState>(() =>
    initialStoryFeedLoadState(initialPageRef.current),
  );

  useEffect(() => {
    const initialPage = initialPageRef.current;

    if (initialPage === null || !initialPage.hasNextPage) {
      return undefined;
    }

    const firstPage = initialPage;
    let isActive = true;

    async function loadRemainingPages() {
      let currentPage = firstPage;
      let stories = [...currentPage.stories];
      const requestedCursors = new Set<string>();

      while (currentPage.hasNextPage) {
        const cursor = currentPage.endCursor;

        // A forward connection must advance its cursor. Treat a malformed or
        // repeating page as unavailable instead of spinning forever or
        // inventing incomplete navigation.
        if (cursor == null || requestedCursors.has(cursor)) {
          if (isActive) {
            setState({ status: 'unavailable', stories });
          }
          return;
        }

        requestedCursors.add(cursor);

        try {
          const pageData = await fetchQuery<StoryViewerOperationsQuery>(
            relayEnvironment,
            storyViewerQuery,
            {
              id: storyId,
              storyAfter: cursor,
              storyFirst: STORY_VIEWER_FEED_SIZE,
            },
            { fetchPolicy: 'network-only' },
          ).toPromise();

          if (!isActive) {
            return;
          }

          const nextPage = pageData
            ? readStoryFeedPage(pageData, storyId)
            : null;

          if (!nextPage) {
            setState({ status: 'unavailable', stories });
            return;
          }

          stories = [...stories, ...nextPage.stories];
          currentPage = nextPage;
        } catch {
          if (isActive) {
            setState({ status: 'unavailable', stories });
          }
          return;
        }
      }

      if (isActive) {
        setState({ status: 'complete', stories });
      }
    }

    void loadRemainingPages();

    return () => {
      isActive = false;
    };
  }, [relayEnvironment, storyId]);

  return state;
}

function readStoryFeedPage(
  data: StoryViewerQueryResponse,
  storyId: string,
): StoryFeedPage | null {
  const selectedNode = data.node?.__typename === 'Post' ? data.node : null;
  const connection = selectedNode?.author.storyFeed;

  if (selectedNode?.id !== storyId || connection == null) {
    return null;
  }

  return {
    endCursor: connection.pageInfo.endCursor ?? null,
    hasNextPage: connection.pageInfo.hasNextPage,
    stories: readConnectionNodes<ContentPost>(connection),
  };
}

function initialStoryFeedLoadState(
  page: StoryFeedPage | null,
): StoryFeedLoadState {
  if (!page) {
    return { status: 'unavailable', stories: [] };
  }

  return {
    status: page.hasNextPage ? 'loading' : 'complete',
    stories: page.stories,
  };
}
