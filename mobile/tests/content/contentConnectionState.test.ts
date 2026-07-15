import { describe, expect, test } from 'vitest';

import {
  contentConnectionReducer,
  createContentConnectionState,
  selectContentRows,
} from '../../src/content/contentConnectionState';

describe('contentConnectionState', () => {
  test('appends pages and keeps the first row for each opaque node ID', () => {
    const initial = createContentConnectionState({
      basePageIdentity: 'profile-a:posts:cursor-1',
      baseRows: [{ id: 'post-1', label: 'base' }],
      pageInfo: { endCursor: 'cursor-1', hasNextPage: true },
      routeGeneration: 1,
    });
    const request = {
      cursor: 'cursor-1',
      key: 'profile-a:posts:cursor-1:1',
      routeGeneration: 1,
    } as const;
    const loading = contentConnectionReducer(initial, {
      request,
      type: 'load_more_start',
    });
    const loaded = contentConnectionReducer(loading, {
      pageInfo: { endCursor: null, hasNextPage: false },
      request,
      rows: [
        { id: 'post-1', label: 'duplicate' },
        { id: 'post-2', label: 'extra' },
      ],
      type: 'load_more_success',
    });

    expect(selectContentRows(loaded)).toEqual([
      { id: 'post-1', label: 'base' },
      { id: 'post-2', label: 'extra' },
    ]);
    expect(loaded.activeRequest).toBeNull();
    expect(loaded.pageInfo).toEqual({
      endCursor: null,
      hasNextPage: false,
    });
  });

  test('ignores equivalent but stale completion objects and old generations', () => {
    const initial = createContentConnectionState({
      basePageIdentity: 'profile-a:posts:cursor-1',
      baseRows: [{ id: 'post-1' }],
      pageInfo: { endCursor: 'cursor-1', hasNextPage: true },
      routeGeneration: 2,
    });
    const request = {
      cursor: 'cursor-1',
      key: 'profile-a:posts:cursor-1:2',
      routeGeneration: 2,
    } as const;
    const loading = contentConnectionReducer(initial, {
      request,
      type: 'load_more_start',
    });

    const equivalentRequest = { ...request };
    expect(
      contentConnectionReducer(loading, {
        pageInfo: { endCursor: null, hasNextPage: false },
        request: equivalentRequest,
        rows: [{ id: 'stale-post' }],
        type: 'load_more_success',
      }),
    ).toBe(loading);

    const replaced = contentConnectionReducer(loading, {
      basePageIdentity: 'profile-b:posts:cursor-b',
      baseRows: [{ id: 'profile-b-post' }],
      pageInfo: { endCursor: 'cursor-b', hasNextPage: true },
      routeGeneration: 3,
      type: 'replace_base',
    });
    expect(
      contentConnectionReducer(replaced, {
        message: 'Old request failed.',
        request,
        type: 'load_more_error',
      }),
    ).toBe(replaced);
  });

  test('keeps loaded rows on retryable errors and across same-base refreshes', () => {
    const initial = createContentConnectionState({
      basePageIdentity: 'profile-a:stories:cursor-1',
      baseRows: [{ id: 'story-1', label: 'old base' }],
      pageInfo: { endCursor: 'cursor-1', hasNextPage: true },
      routeGeneration: 1,
    });
    const request = {
      cursor: 'cursor-1',
      key: 'profile-a:stories:cursor-1:1',
      routeGeneration: 1,
    } as const;
    const loading = contentConnectionReducer(initial, {
      request,
      type: 'load_more_start',
    });
    const failed = contentConnectionReducer(loading, {
      message: 'Stories could not load.',
      request,
      type: 'load_more_error',
    });

    expect(selectContentRows(failed)).toEqual([
      { id: 'story-1', label: 'old base' },
    ]);
    expect(failed.error).toBe('Stories could not load.');

    const refreshed = contentConnectionReducer(failed, {
      basePageIdentity: 'profile-a:stories:cursor-1',
      baseRows: [{ id: 'story-1', label: 'fresh base' }],
      pageInfo: { endCursor: 'cursor-1', hasNextPage: true },
      routeGeneration: 1,
      type: 'replace_base',
    });
    expect(selectContentRows(refreshed)).toEqual([
      { id: 'story-1', label: 'fresh base' },
    ]);
    expect(refreshed.error).toBeNull();
  });
});
