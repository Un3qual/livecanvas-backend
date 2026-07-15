import { useLocalSearchParams } from 'expo-router';

import { ScreenState } from '../../../src/components/ScreenState';
import { readStoryIdParam } from '../../../src/content/story/storyNavigation';
import { StoryViewerScreen } from '../../../src/content/story/StoryViewerScreen';

export default function StoryViewerRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const storyId = readStoryIdParam(params.id);

  return storyId ? (
    <StoryViewerScreen storyId={storyId} />
  ) : (
    <ScreenState state="empty" message="Story link is invalid." />
  );
}
