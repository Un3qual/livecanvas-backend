import { describe, expect, test } from 'bun:test';

import {
  type FeedHomePaginationPageInfo,
  createFeedHomePaginationState,
  feedHomePaginationReducer,
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
  test('delegates section rows and opaque request identity to universal connection state', () => {
    const request = {
      cursor: 'story-cursor-1',
      key: 'home:stories:1',
      routeGeneration: 0,
    } as const;
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
    expect(loadedState.connections.stories.activeRequest).toBeNull();
  });

  test('loads more stories without affecting home feed or replays', () => {
    const initialState = createFeedHomePaginationState({});
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
      hasLoadedMore: true,
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
      feedHomePaginationReducer(createFeedHomePaginationState({}), {
        section: 'replays',
        type: 'load_more_start',
      }),
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
      hasLoadedMore: false,
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

  test('clears stale load-more errors when fresh query pageInfo syncs', () => {
    const failedState = feedHomePaginationReducer(
      feedHomePaginationReducer(createFeedHomePaginationState({}), {
        section: 'stories',
        type: 'load_more_start',
      }),
      {
        message: 'Stories could not load.',
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

    expect(syncedState.sections.stories).toEqual({
      error: null,
      hasLoadedMore: false,
      isLoadingMore: false,
      pageInfo: {
        endCursor: 'story-network-cursor',
        hasNextPage: true,
      },
    });
  });

  test('refresh keeps existing cursors until success updates every section pageInfo', () => {
    const pagedState = createFeedHomePaginationState({
      homeFeed: nextPage,
      replays: nextPage,
      stories: nextPage,
    });
    const dirtyState = feedHomePaginationReducer(
      feedHomePaginationReducer(
        pagedState,
        {
          message: 'Replays could not load.',
          section: 'replays',
          type: 'load_more_error',
        },
      ),
      {
        section: 'stories',
        type: 'load_more_start',
      },
    );

    const refreshingState = feedHomePaginationReducer(dirtyState, {
      type: 'refresh_start',
    });

    expect(refreshingState.isRefreshing).toBe(true);
    expect(refreshingState.refreshError).toBeNull();
    expect(selectFeedHomePageInfo(refreshingState, 'homeFeed')).toEqual(
      nextPage,
    );
    expect(selectFeedHomePageInfo(refreshingState, 'replays')).toEqual(
      nextPage,
    );
    expect(selectFeedHomePageInfo(refreshingState, 'stories')).toEqual(
      nextPage,
    );

    const refreshedState = feedHomePaginationReducer(refreshingState, {
      sections: {
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
    expect(refreshedState.sections.homeFeed).toEqual({
      error: null,
      hasLoadedMore: false,
      isLoadingMore: false,
      pageInfo: {
        endCursor: 'home-cursor-2',
        hasNextPage: false,
      },
    });
    expect(refreshedState.sections.replays).toEqual({
      error: null,
      hasLoadedMore: false,
      isLoadingMore: false,
      pageInfo: {
        endCursor: 'replay-cursor-2',
        hasNextPage: false,
      },
    });
    expect(refreshedState.sections.stories).toEqual({
      error: null,
      hasLoadedMore: false,
      isLoadingMore: false,
      pageInfo: {
        endCursor: 'story-cursor-2',
        hasNextPage: true,
      },
    });
  });

  test('syncs query pageInfo until a local load-more page is applied', () => {
    const initialState = createFeedHomePaginationState({
      stories: {
        endCursor: null,
        hasNextPage: false,
      },
    });
    const syncedState = feedHomePaginationReducer(initialState, {
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

    expect(selectFeedHomePageInfo(syncedState, 'stories')).toEqual({
      endCursor: 'story-network-cursor',
      hasNextPage: true,
    });

    const locallyPagedState = feedHomePaginationReducer(
      feedHomePaginationReducer(syncedState, {
        section: 'stories',
        type: 'load_more_start',
      }),
      {
        pageInfo: {
          endCursor: 'story-local-cursor',
          hasNextPage: true,
        },
        section: 'stories',
        type: 'load_more_success',
      },
    );
    const resyncedState = feedHomePaginationReducer(locallyPagedState, {
      sections: {
        homeFeed: nextPage,
        replays: nextPage,
        stories: {
          endCursor: 'story-network-cursor-2',
          hasNextPage: false,
        },
      },
      type: 'query_page_info_sync',
    });

    expect(selectFeedHomePageInfo(resyncedState, 'stories')).toEqual({
      endCursor: 'story-local-cursor',
      hasNextPage: true,
    });
  });

  test('resets locally paged cursors when the query base page changes', () => {
    const initialState = createFeedHomePaginationState({
      homeFeed: pageInfoWithBase('home-base-cursor', true, 'post-1'),
    });
    const locallyPagedState = feedHomePaginationReducer(
      feedHomePaginationReducer(initialState, {
        section: 'homeFeed',
        type: 'load_more_start',
      }),
      {
        pageInfo: {
          endCursor: 'home-older-cursor',
          hasNextPage: true,
        },
        section: 'homeFeed',
        type: 'load_more_success',
      },
    );

    const syncedState = feedHomePaginationReducer(locallyPagedState, {
      sections: {
        homeFeed: pageInfoWithBase('home-new-base-cursor', true, 'post-0'),
        replays: nextPage,
        stories: nextPage,
      },
      type: 'query_page_info_sync',
    });

    expect(syncedState.sections.homeFeed).toEqual({
      error: null,
      hasLoadedMore: false,
      isLoadingMore: false,
      pageInfo: {
        endCursor: 'home-new-base-cursor',
        hasNextPage: true,
      },
    });
    expect(selectFeedHomePageInfo(syncedState, 'homeFeed')).toEqual({
      endCursor: 'home-new-base-cursor',
      hasNextPage: true,
    });
  });
});

function pageInfoWithBase(
  endCursor: string | null,
  hasNextPage: boolean,
  basePageIdentity: string,
): PageInfoWithBase {
  return { basePageIdentity, endCursor, hasNextPage };
}
