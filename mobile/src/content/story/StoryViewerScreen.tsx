import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLazyLoadQuery } from 'react-relay';

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
  const data = useLazyLoadQuery<StoryViewerOperationsQuery>(
    storyViewerQuery,
    { id: storyId, storyFirst: STORY_VIEWER_FEED_SIZE },
    { ...PRIVACY_SENSITIVE_FETCH_OPTIONS, fetchKey: queryFetchKey },
  );
  const selectedNode = data.node?.__typename === 'Post' ? data.node : null;
  const feedStories = readConnectionNodes<ContentPost>(
    selectedNode?.author.storyFeed,
  );
  const state = selectStoryViewerState({
    feedStories,
    now: Date.now(),
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
