import { describe, expect, test } from 'bun:test';

import {
  type FeedHomePaginationPageInfo,
  type FeedHomePaginationSection,
  createFeedHomePaginationState,
  feedHomePaginationReducer,
  selectFeedHomeBasePageIdentity,
  selectFeedHomeLoadMoreState,
  selectFeedHomePageInfo,
  selectFeedHomeRows,
} from '../../src/feed/feedHomePagination';

const nextPage: FeedHomePaginationPageInfo = {
  endCursor: 'cursor-1',
  hasNextPage: true,
};

type PageInfoWithBase = FeedHomePaginationPageInfo & {
  readonly basePageIdentity?: string;
};

describe('feedHomePaginationReducer', () => {
  test('keeps the connection map as the only section state source', () => {
    const state = createFeedHomePaginationState({
      stories: {
        basePageIdentity: 'story-base',
        endCursor: 'story-cursor',
        hasNextPage: true,
        rows: [{ id: 'story-1' }],
      },
    });

    expect(Object.keys(state).sort()).toEqual([
      'connections',
      'isRefreshing',
      'refreshError',
    ]);
    expect(selectFeedHomeBasePageIdentity(state, 'stories')).toBe(
      'story-base',
    );
  });

  test('delegates rows and opaque request identity to universal connection state', () => {
    const request = loadRequest('stories', 'story-cursor-1');
    const initialState = createFeedHomePaginationState({
      stories: {
        basePageIdentity: 'story-1',
        endCursor: 'story-cursor-1',
        hasNextPage: true,
        rows: [{ id: 'story-1' }],
      },
    });
    const loadingState = feedHomePaginationReducer(initialState, {
      request,
      section: 'stories',
      type: 'load_more_start',
    });
    const loadedState = feedHomePaginationReducer(loadingState, {
      pageInfo: { endCursor: null, hasNextPage: false },
      request,
      rows: [
        { id: 'story-1' },
        { id: 'story-2' },
      ],
      section: 'stories',
      type: 'load_more_success',
    });

    expect(selectFeedHomeRows(loadedState, 'stories')).toEqual([
      { id: 'story-1' },
      { id: 'story-2' },
    ]);
    expect(selectFeedHomeLoadMoreState(loadedState, 'stories')).toEqual({
      error: null,
      isLoading: false,
    });
  });

  test('loads one section without changing sibling connections', () => {
    const initialState = createFeedHomePaginationState({ stories: nextPage });
    const request = loadRequest('stories', 'cursor-1');
    const loadingState = feedHomePaginationReducer(initialState, {
      request,
      section: 'stories',
      type: 'load_more_start',
    });

    expect(selectFeedHomeLoadMoreState(loadingState, 'stories')).toEqual({
      error: null,
      isLoading: true,
    });
    expect(loadingState.connections.homeFeed).toBe(
      initialState.connections.homeFeed,
    );
    expect(loadingState.connections.replays).toBe(
      initialState.connections.replays,
    );

    const loadedState = feedHomePaginationReducer(loadingState, {
      pageInfo: {
        endCursor: 'story-cursor-2',
        hasNextPage: true,
      },
      request,
      rows: [],
      section: 'stories',
      type: 'load_more_success',
    });

    expect(selectFeedHomePageInfo(loadedState, 'stories')).toEqual({
      endCursor: 'story-cursor-2',
      hasNextPage: true,
    });
  });

  test('keeps retryable errors scoped to their connection', () => {
    const initialState = createFeedHomePaginationState({
      replays: nextPage,
      stories: nextPage,
    });
    const replayRequest = loadRequest('replays', 'cursor-1');
    const storyRequest = loadRequest('stories', 'cursor-1');
    const replayFailedState = feedHomePaginationReducer(
      feedHomePaginationReducer(initialState, {
        request: replayRequest,
        section: 'replays',
        type: 'load_more_start',
      }),
      {
        message: 'Replays could not load.',
        request: replayRequest,
        section: 'replays',
        type: 'load_more_error',
      },
    );
    const storiesFailedState = feedHomePaginationReducer(
      feedHomePaginationReducer(replayFailedState, {
        request: storyRequest,
        section: 'stories',
        type: 'load_more_start',
      }),
      {
        message: 'Stories could not load.',
        request: storyRequest,
        section: 'stories',
        type: 'load_more_error',
      },
    );

    expect(selectFeedHomeLoadMoreState(storiesFailedState, 'stories')).toEqual({
      error: 'Stories could not load.',
      isLoading: false,
    });
    expect(selectFeedHomeLoadMoreState(storiesFailedState, 'replays')).toEqual({
      error: 'Replays could not load.',
      isLoading: false,
    });
    expect(
      selectFeedHomeLoadMoreState(storiesFailedState, 'homeFeed').error,
    ).toBeNull();
  });

  test('clears stale load-more errors when fresh query state syncs', () => {
    const request = loadRequest('stories', 'cursor-1');
    const failedState = feedHomePaginationReducer(
      feedHomePaginationReducer(
        createFeedHomePaginationState({ stories: nextPage }),
        {
          request,
          section: 'stories',
          type: 'load_more_start',
        },
      ),
      {
        message: 'Stories could not load.',
        request,
        section: 'stories',
        type: 'load_more_error',
      },
    );

    const syncedState = feedHomePaginationReducer(failedState, {
      sections: {
        homeFeed: nextPage,
        replays: nextPage,
        stories: {
          endCursor: 'story-network-cursor',
          hasNextPage: true,
        },
      },
      type: 'query_page_info_sync',
    });

    expect(selectFeedHomeLoadMoreState(syncedState, 'stories')).toEqual({
      error: null,
      isLoading: false,
    });
    expect(selectFeedHomePageInfo(syncedState, 'stories')).toEqual({
      endCursor: 'story-network-cursor',
      hasNextPage: true,
    });
  });

  test('refresh cancels active requests and updates every connection on success', () => {
    const storyRequest = loadRequest('stories', 'cursor-1');
    const loadingState = feedHomePaginationReducer(
      createFeedHomePaginationState({
        homeFeed: nextPage,
        replays: nextPage,
        stories: nextPage,
      }),
      {
        request: storyRequest,
        section: 'stories',
        type: 'load_more_start',
      },
    );
    const refreshingState = feedHomePaginationReducer(loadingState, {
      type: 'refresh_start',
    });

    expect(refreshingState.isRefreshing).toBe(true);
    expect(refreshingState.refreshError).toBeNull();
    expect(selectFeedHomeLoadMoreState(refreshingState, 'stories').isLoading).toBe(
      false,
    );
    expect(selectFeedHomePageInfo(refreshingState, 'stories')).toEqual(nextPage);

    const refreshedState = feedHomePaginationReducer(refreshingState, {
      sections: {
        homeFeed: { endCursor: 'home-cursor-2', hasNextPage: false },
        replays: { endCursor: 'replay-cursor-2', hasNextPage: false },
        stories: { endCursor: 'story-cursor-2', hasNextPage: true },
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

  test('replaces locally paged rows and cursor with the refreshed first page', () => {
    const request = loadRequest('homeFeed', 'home-base-cursor');
    const initialState = createFeedHomePaginationState({
      homeFeed: {
        basePageIdentity: 'home-base',
        endCursor: 'home-base-cursor',
        hasNextPage: true,
        rows: [{ id: 'post-1' }],
      },
    });
    const locallyPagedState = feedHomePaginationReducer(
      feedHomePaginationReducer(initialState, {
        request,
        section: 'homeFeed',
        type: 'load_more_start',
      }),
      {
        pageInfo: { endCursor: 'home-older-cursor', hasNextPage: true },
        request,
        rows: [{ id: 'post-2' }],
        section: 'homeFeed',
        type: 'load_more_success',
      },
    );
    const refreshedState = feedHomePaginationReducer(locallyPagedState, {
      sections: {
        homeFeed: {
          basePageIdentity: 'home-base',
          endCursor: 'home-refreshed-base-cursor',
          hasNextPage: true,
          rows: [{ id: 'post-0' }, { id: 'post-1' }],
        },
        replays: nextPage,
        stories: nextPage,
      },
      type: 'refresh_success',
    });

    expect(selectFeedHomeRows(refreshedState, 'homeFeed')).toEqual([
      { id: 'post-0' },
      { id: 'post-1' },
    ]);
    expect(selectFeedHomePageInfo(refreshedState, 'homeFeed')).toEqual({
      endCursor: 'home-refreshed-base-cursor',
      hasNextPage: true,
    });
  });

  test('resets loaded rows and cursors when the query base changes', () => {
    const request = loadRequest('homeFeed', 'home-base-cursor');
    const initialState = createFeedHomePaginationState({
      homeFeed: pageInfoWithBase('home-base-cursor', true, 'post-1'),
    });
    const locallyPagedState = feedHomePaginationReducer(
      feedHomePaginationReducer(initialState, {
        request,
        section: 'homeFeed',
        type: 'load_more_start',
      }),
      {
        pageInfo: { endCursor: 'home-older-cursor', hasNextPage: true },
        request,
        rows: [{ id: 'post-2' }],
        section: 'homeFeed',
        type: 'load_more_success',
      },
    );

    const syncedState = feedHomePaginationReducer(locallyPagedState, {
      sections: {
        homeFeed: {
          ...pageInfoWithBase('home-new-base-cursor', true, 'post-0'),
          rows: [{ id: 'post-0' }],
        },
        replays: nextPage,
        stories: nextPage,
      },
      type: 'query_page_info_sync',
    });

    expect(selectFeedHomeBasePageIdentity(syncedState, 'homeFeed')).toBe(
      'post-0',
    );
    expect(selectFeedHomeRows(syncedState, 'homeFeed')).toEqual([
      { id: 'post-0' },
    ]);
    expect(selectFeedHomePageInfo(syncedState, 'homeFeed')).toEqual({
      endCursor: 'home-new-base-cursor',
      hasNextPage: true,
    });
  });
});

function loadRequest(
  section: FeedHomePaginationSection,
  cursor: string,
) {
  return {
    cursor,
    key: `home:${section}:${cursor}`,
    routeGeneration: 0,
  } as const;
}

function pageInfoWithBase(
  endCursor: string | null,
  hasNextPage: boolean,
  basePageIdentity: string,
): PageInfoWithBase {
  return { basePageIdentity, endCursor, hasNextPage };
}
