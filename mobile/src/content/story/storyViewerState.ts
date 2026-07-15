import type { ContentPost } from '../ContentPostCard';

export type StoryViewerState = Readonly<{
  navigationStatus: 'available' | 'unavailable';
  nextStoryId: string | null;
  previousStoryId: string | null;
  progressLabel: string | null;
  selectedIndex: number | null;
  selectedStory: ContentPost | null;
  total: number | null;
}>;

export function selectStoryViewerState({
  feedStatus,
  feedStories,
  selectedStory,
  selectedStoryId,
}: {
  readonly feedStatus: 'complete' | 'unavailable';
  readonly feedStories: ReadonlyArray<ContentPost>;
  readonly selectedStory: ContentPost | null;
  readonly selectedStoryId: string;
}): StoryViewerState {
  // The Relay node resolver and author story feed both enforce visibility and
  // expiry using server time. Re-applying expiry with the device clock would
  // incorrectly hide authorized stories on clock-skewed devices.
  if (selectedStory?.id !== selectedStoryId || selectedStory.kind !== 'STORY') {
    return unavailableStoryViewerState();
  }

  if (feedStatus === 'unavailable') {
    return {
      navigationStatus: 'unavailable',
      nextStoryId: null,
      previousStoryId: null,
      progressLabel: 'Story navigation unavailable',
      selectedIndex: null,
      selectedStory,
      total: null,
    };
  }

  const stories = dedupeStories(feedStories);
  const selectedIndex = stories.findIndex(
    (story) => story.id === selectedStoryId,
  );

  if (selectedIndex === -1) {
    // A complete server-filtered feed that omits the selected node means the
    // story is no longer active for this viewer.
    return unavailableStoryViewerState();
  }

  return {
    navigationStatus: 'available',
    nextStoryId: stories[selectedIndex + 1]?.id ?? null,
    previousStoryId: stories[selectedIndex - 1]?.id ?? null,
    progressLabel: `${selectedIndex + 1} of ${stories.length}`,
    selectedIndex,
    selectedStory: stories[selectedIndex] ?? null,
    total: stories.length,
  };
}

function dedupeStories(stories: ReadonlyArray<ContentPost>): ContentPost[] {
  const seenIds = new Set<string>();

  return stories.filter((story) => {
    if (seenIds.has(story.id) || story.kind !== 'STORY') {
      return false;
    }

    seenIds.add(story.id);
    return true;
  });
}

function unavailableStoryViewerState(): StoryViewerState {
  return {
    navigationStatus: 'unavailable',
    nextStoryId: null,
    previousStoryId: null,
    progressLabel: null,
    selectedIndex: null,
    selectedStory: null,
    total: 0,
  };
}
