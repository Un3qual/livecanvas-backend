import { describe, expect, test } from 'bun:test';

import {
  createFeedHomePaginationState,
  feedHomePaginationReducer,
  selectFeedHomePageInfo,
} from '../../src/feed/feedHomePagination';

describe('feedHomePaginationReducer', () => {
  test('loads more stories without affecting home feed or replays', () => {
    const initialState = createFeedHomePaginationState();
    const loadingState = feedHomePaginationReducer(initialState, {
      section: 'stories',
      type: 'load_more_start',
    });

    expect(loadingState.sections.stories.isLoadingMore).toBe(true);
    expect(loadingState.sections.stories.error).toBeNull();
    expect(loadingState.sections.homeFeed).toBe(initialState.sections.homeFeed);
    expect(loadingState.sections.replays).toBe(initialState.sections.replays);

    const loadedState = feedHomePaginationReducer(loadingState, {
      pageInfo: {
        endCursor: 'story-cursor-2',
        hasNextPage: true,
      },
      section: 'stories',
      type: 'load_more_success',
    });

    expect(loadedState.sections.stories).toEqual({
      error: null,
      isLoadingMore: false,
      pageInfo: {
        endCursor: 'story-cursor-2',
        hasNextPage: true,
      },
    });
    expect(selectFeedHomePageInfo(loadedState, 'stories')).toEqual({
      endCursor: 'story-cursor-2',
      hasNextPage: true,
    });
    expect(loadedState.sections.homeFeed).toBe(initialState.sections.homeFeed);
    expect(loadedState.sections.replays).toBe(initialState.sections.replays);
  });

  test('stores retryable story load-more errors without clearing other section errors', () => {
    const replayFailedState = feedHomePaginationReducer(
      createFeedHomePaginationState(),
      {
        message: 'Replays could not load.',
        section: 'replays',
        type: 'load_more_error',
      },
    );
    const storiesLoadingState = feedHomePaginationReducer(replayFailedState, {
      section: 'stories',
      type: 'load_more_start',
    });
    const storiesFailedState = feedHomePaginationReducer(storiesLoadingState, {
      message: 'Stories could not load.',
      section: 'stories',
      type: 'load_more_error',
    });

    expect(storiesFailedState.sections.stories).toEqual({
      error: 'Stories could not load.',
      isLoadingMore: false,
      pageInfo: {
        endCursor: null,
        hasNextPage: false,
      },
    });
    expect(storiesFailedState.sections.replays.error).toBe(
      'Replays could not load.',
    );
    expect(storiesFailedState.sections.homeFeed.error).toBeNull();
  });

  test('refresh keeps existing cursors until success updates every section pageInfo', () => {
    const pagedState = feedHomePaginationReducer(
      feedHomePaginationReducer(
        feedHomePaginationReducer(createFeedHomePaginationState(), {
          pageInfo: {
            endCursor: 'home-cursor-1',
            hasNextPage: true,
          },
          section: 'homeFeed',
          type: 'load_more_success',
        }),
        {
          pageInfo: {
            endCursor: 'replay-cursor-1',
            hasNextPage: true,
          },
          section: 'replays',
          type: 'load_more_success',
        },
      ),
      {
        pageInfo: {
          endCursor: 'story-cursor-1',
          hasNextPage: true,
        },
        section: 'stories',
        type: 'load_more_success',
      },
    );

    const refreshingState = feedHomePaginationReducer(pagedState, {
      type: 'refresh_start',
    });

    expect(refreshingState.isRefreshing).toBe(true);
    expect(refreshingState.refreshError).toBeNull();
    expect(selectFeedHomePageInfo(refreshingState, 'homeFeed')).toEqual({
      endCursor: 'home-cursor-1',
      hasNextPage: true,
    });
    expect(selectFeedHomePageInfo(refreshingState, 'replays')).toEqual({
      endCursor: 'replay-cursor-1',
      hasNextPage: true,
    });
    expect(selectFeedHomePageInfo(refreshingState, 'stories')).toEqual({
      endCursor: 'story-cursor-1',
      hasNextPage: true,
    });

    const refreshedState = feedHomePaginationReducer(refreshingState, {
      pageInfo: {
        homeFeed: {
          endCursor: 'home-cursor-2',
          hasNextPage: false,
        },
        replays: {
          endCursor: 'replay-cursor-2',
          hasNextPage: false,
        },
        stories: {
          endCursor: 'story-cursor-2',
          hasNextPage: true,
        },
      },
      type: 'refresh_success',
    });

    expect(refreshedState.isRefreshing).toBe(false);
    expect(refreshedState.refreshError).toBeNull();
    expect(selectFeedHomePageInfo(refreshedState, 'homeFeed')).toEqual({
      endCursor: 'home-cursor-2',
      hasNextPage: false,
    });
    expect(selectFeedHomePageInfo(refreshedState, 'replays')).toEqual({
      endCursor: 'replay-cursor-2',
      hasNextPage: false,
    });
    expect(selectFeedHomePageInfo(refreshedState, 'stories')).toEqual({
      endCursor: 'story-cursor-2',
      hasNextPage: true,
    });
  });
});
