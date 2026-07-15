import { describe, expect, test } from 'vitest';

import {
  selectStoryViewerState,
} from '../../src/content/story/storyViewerState';
import {
  readStoryIdParam,
  storyHref,
} from '../../src/content/story/storyNavigation';
import type { ContentPost } from '../../src/content/ContentPostCard';

describe('storyViewerState', () => {
  test('keeps story route IDs opaque and rejects ambiguous params', () => {
    expect(storyHref('opaque/story:id')).toEqual({
      params: { id: 'opaque/story:id' },
      pathname: '/stories/[id]',
    });
    expect(readStoryIdParam('  opaque/story:id  ')).toBe('opaque/story:id');
    expect(readStoryIdParam(['opaque/story:id'])).toBe('opaque/story:id');
    expect(readStoryIdParam(['story-1', 'story-2'])).toBeNull();
    expect(readStoryIdParam('   ')).toBeNull();
  });

  test('selects an opaque ID and exposes middle-story boundaries and progress', () => {
    const state = selectStoryViewerState({
      feedStatus: 'complete',
      feedStories: [story('story-1'), story('story-2'), story('story-3')],
      selectedStory: story('story-2'),
      selectedStoryId: 'story-2',
    });

    expect(state).toMatchObject({
      nextStoryId: 'story-3',
      previousStoryId: 'story-1',
      progressLabel: '2 of 3',
      selectedIndex: 1,
      total: 3,
    });
    expect(state.selectedStory?.id).toBe('story-2');
  });

  test('keeps first and last boundaries closed', () => {
    const stories = [story('story-1'), story('story-2')];

    expect(
      selectStoryViewerState({
        feedStatus: 'complete',
        feedStories: stories,
        selectedStory: stories[0],
        selectedStoryId: 'story-1',
      }),
    ).toMatchObject({ previousStoryId: null, nextStoryId: 'story-2' });
    expect(
      selectStoryViewerState({
        feedStatus: 'complete',
        feedStories: stories,
        selectedStory: stories[1],
        selectedStoryId: 'story-2',
      }),
    ).toMatchObject({ previousStoryId: 'story-1', nextStoryId: null });
  });

  test('rejects mismatched and non-story selections', () => {
    const selectedPost = story('post', { expiresAt: null, kind: 'STANDARD' });

    expect(
      selectStoryViewerState({
        feedStatus: 'complete',
        feedStories: [selectedPost],
        selectedStory: selectedPost,
        selectedStoryId: selectedPost.id,
      }).selectedStory,
    ).toBeNull();
    expect(
      selectStoryViewerState({
        feedStatus: 'complete',
        feedStories: [story('story-1')],
        selectedStory: story('story-1'),
        selectedStoryId: 'story-2',
      }).selectedStory,
    ).toBeNull();
  });

  test('recomputes selection and boundaries from replacement feed data', () => {
    const initial = selectStoryViewerState({
      feedStatus: 'complete',
      feedStories: [story('story-1'), story('story-2')],
      selectedStory: story('story-2'),
      selectedStoryId: 'story-2',
    });
    const replaced = selectStoryViewerState({
      feedStatus: 'complete',
      feedStories: [story('story-3'), story('story-2'), story('story-1')],
      selectedStory: story('story-2'),
      selectedStoryId: 'story-2',
    });

    expect(initial).toMatchObject({
      nextStoryId: null,
      previousStoryId: 'story-1',
      progressLabel: '2 of 2',
    });
    expect(replaced).toMatchObject({
      nextStoryId: 'story-1',
      previousStoryId: 'story-3',
      progressLabel: '2 of 3',
    });
  });

  test('does not invent navigation when the author feed is unavailable', () => {
    const state = selectStoryViewerState({
      feedStatus: 'unavailable',
      feedStories: [],
      selectedStory: story('deep-linked-story'),
      selectedStoryId: 'deep-linked-story',
    });

    expect(state).toMatchObject({
      nextStoryId: null,
      navigationStatus: 'unavailable',
      previousStoryId: null,
      progressLabel: 'Story navigation unavailable',
      total: null,
    });
    expect(state.selectedStory?.id).toBe('deep-linked-story');
  });

  test('rejects a selected story missing from a complete server feed', () => {
    const state = selectStoryViewerState({
      feedStatus: 'complete',
      feedStories: [story('story-1')],
      selectedStory: story('deep-linked-story'),
      selectedStoryId: 'deep-linked-story',
    });

    expect(state.selectedStory).toBeNull();
  });
});

function story(
  id: string,
  overrides: Partial<ContentPost> = {},
): ContentPost {
  return {
    author: { email: 'creator@example.test', id: 'author-id' },
    bodyText: `Story ${id}`,
    expiresAt: '2026-07-15T12:00:00.000Z',
    id,
    insertedAt: '2026-07-14T10:00:00.000Z',
    kind: 'STORY',
    mediaAssets: [],
    visibility: 'PUBLIC',
    ...overrides,
  };
}
