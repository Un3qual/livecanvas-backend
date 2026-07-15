import type { ContentPost } from '../ContentPostCard';

export type StoryViewerState = Readonly<{
  nextStoryId: string | null;
  previousStoryId: string | null;
  progressLabel: string | null;
  selectedIndex: number | null;
  selectedStory: ContentPost | null;
  total: number;
}>;

export function selectStoryViewerState({
  feedStories,
  now,
  selectedStory,
  selectedStoryId,
}: {
  readonly feedStories: ReadonlyArray<ContentPost>;
  readonly now: number;
  readonly selectedStory: ContentPost | null;
  readonly selectedStoryId: string;
}): StoryViewerState {
  if (
    selectedStory?.id !== selectedStoryId ||
    !isActiveStory(selectedStory, now)
  ) {
    return unavailableStoryViewerState();
  }

  const activeStories = dedupeActiveStories(feedStories, now);
  const selectedIndex = activeStories.findIndex(
    (story) => story.id === selectedStoryId,
  );

  if (selectedIndex === -1) {
    // A bounded author feed can omit a valid deep-linked story. Show that
    // selected node without inventing its ordering relative to the feed page.
    return {
      nextStoryId: null,
      previousStoryId: null,
      progressLabel: '1 of 1',
      selectedIndex: 0,
      selectedStory,
      total: 1,
    };
  }

  return {
    nextStoryId: activeStories[selectedIndex + 1]?.id ?? null,
    previousStoryId: activeStories[selectedIndex - 1]?.id ?? null,
    progressLabel: `${selectedIndex + 1} of ${activeStories.length}`,
    selectedIndex,
    selectedStory: activeStories[selectedIndex] ?? null,
    total: activeStories.length,
  };
}

function dedupeActiveStories(
  stories: ReadonlyArray<ContentPost>,
  now: number,
): ContentPost[] {
  const seenIds = new Set<string>();

  return stories.filter((story) => {
    if (seenIds.has(story.id) || !isActiveStory(story, now)) {
      return false;
    }

    seenIds.add(story.id);
    return true;
  });
}

function isActiveStory(story: ContentPost, now: number): boolean {
  if (story.kind !== 'STORY' || !story.expiresAt) {
    return false;
  }

  const expiresAt = Date.parse(story.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

function unavailableStoryViewerState(): StoryViewerState {
  return {
    nextStoryId: null,
    previousStoryId: null,
    progressLabel: null,
    selectedIndex: null,
    selectedStory: null,
    total: 0,
  };
}
