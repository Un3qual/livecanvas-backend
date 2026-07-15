import { render, screen, userEvent } from '@testing-library/react-native';

import { ContentSection } from '../../src/content/ContentSection';
import type { ContentPost } from '../../src/content/ContentPostCard';
import { createPostOwnerControlsState } from '../../src/content/postOwnerControlsReducer';
import type { PostControls } from '../../src/content/usePostControls';
import { createReportPostState } from '../../src/content/reportPostReducer';
import { storyHref } from '../../src/content/story/storyNavigation';

describe('ContentSection', () => {
  test('renders post rows with controls and a view-all action', async () => {
    const user = userEvent.setup();
    const onViewAll = jest.fn();

    await render(
      <ContentSection
        emptyMessage="No posts yet."
        kind="posts"
        onViewAll={onViewAll}
        postControls={postControls()}
        posts={[post({ id: 'opaque-post-id' })]}
        title="Posts"
        viewerId="viewer-id"
      />,
    );

    expect(screen.getByTestId('content-section-posts')).toBeOnTheScreen();
    expect(screen.getByText('Post body')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Edit post' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'View story' })).toBeNull();

    await user.press(screen.getByRole('button', { name: 'View all' }));
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });

  test('renders live and replay rows with kind-specific watch actions', async () => {
    const user = userEvent.setup();
    const onOpenLiveSession = jest.fn();
    const liveSession = session({ id: 'opaque-live-id', status: 'LIVE' });
    const replaySession = session({ id: 'opaque-replay-id', status: 'ENDED' });

    const view = await render(
      <ContentSection
        emptyMessage="No live sessions."
        kind="live"
        onOpenLiveSession={onOpenLiveSession}
        sessions={[liveSession]}
        title="Live now"
      />,
    );

    expect(screen.getByTestId('content-section-live')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Watch live' }));
    expect(onOpenLiveSession).toHaveBeenLastCalledWith('opaque-live-id');

    await view.rerender(
      <ContentSection
        emptyMessage="No replays."
        kind="replays"
        onOpenLiveSession={onOpenLiveSession}
        sessions={[replaySession]}
        title="Replays"
      />,
    );

    expect(screen.getByTestId('content-section-replays')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Watch replay' }));
    expect(onOpenLiveSession).toHaveBeenLastCalledWith('opaque-replay-id');
  });

  test('renders neutral empty copy without row actions', async () => {
    await render(
      <ContentSection
        emptyMessage="Nothing has been shared yet."
        kind="stories"
        onOpenStory={jest.fn()}
        postControls={postControls()}
        posts={[]}
        title="Stories"
        viewerId="viewer-id"
      />,
    );

    expect(screen.getByText('Nothing has been shared yet.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Edit post' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Report post' })).toBeNull();
  });

  test('routes story rows through the opaque story action', async () => {
    const user = userEvent.setup();
    const pushedRoutes: unknown[] = [];

    await render(
      <ContentSection
        emptyMessage="No stories."
        kind="stories"
        onOpenStory={(storyId) => pushedRoutes.push(storyHref(storyId))}
        postControls={postControls()}
        posts={[post({ id: 'opaque-story-id', kind: 'STORY' })]}
        title="Stories"
        viewerId="viewer-id"
      />,
    );

    await user.press(screen.getByRole('button', { name: 'View story' }));

    expect(pushedRoutes).toEqual([storyHref('opaque-story-id')]);
  });

  test('renders load-more, retryable error, and disabled loading states', async () => {
    const user = userEvent.setup();
    const onLoadMore = jest.fn();
    const baseProps = {
      emptyMessage: 'No stories.',
      kind: 'stories' as const,
      onOpenStory: jest.fn(),
      postControls: postControls(),
      posts: [post({ id: 'story-id', kind: 'STORY' })],
      title: 'Stories',
      viewerId: 'viewer-id',
    };

    const view = await render(
      <ContentSection
        {...baseProps}
        loadMore={{
          error: null,
          isLoading: false,
          onLoadMore,
          visible: true,
        }}
      />,
    );

    await user.press(
      screen.getByRole('button', { name: 'Load more stories' }),
    );
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    await view.rerender(
      <ContentSection
        {...baseProps}
        loadMore={{
          error: 'Stories could not load.',
          isLoading: false,
          onLoadMore,
          visible: true,
        }}
      />,
    );
    expect(screen.getByText('Stories could not load.')).toBeOnTheScreen();
    await user.press(
      screen.getByRole('button', { name: 'Load more stories' }),
    );
    expect(onLoadMore).toHaveBeenCalledTimes(2);

    await view.rerender(
      <ContentSection
        {...baseProps}
        loadMore={{
          error: null,
          isLoading: true,
          onLoadMore,
          visible: true,
        }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();
  });
});

function post({
  id,
  kind = 'STANDARD',
}: {
  id: string;
  kind?: string;
}): ContentPost {
  return {
    author: { email: 'viewer@example.com', id: 'viewer-id' },
    bodyText: 'Post body',
    expiresAt: null,
    id,
    insertedAt: '2026-07-09T12:00:00.000000Z',
    kind,
    mediaAssets: [],
    visibility: 'PUBLIC',
  };
}

function session({ id, status }: { id: string; status: string }) {
  return {
    endedAt: status === 'ENDED' ? '2026-07-09T12:30:00.000000Z' : null,
    host: { email: 'host@example.com', id: 'host-id' },
    id,
    insertedAt: '2026-07-09T12:00:00.000000Z',
    startedAt: '2026-07-09T12:05:00.000000Z',
    status,
    visibility: 'PUBLIC',
  };
}

function postControls(): PostControls {
  return {
    actions: {
      cancelDelete: jest.fn(),
      cancelEdit: jest.fn(),
      confirmDelete: jest.fn(),
      deletePost: jest.fn(),
      reportPost: jest.fn(),
      saveEdit: jest.fn(),
      selectEditVisibility: jest.fn(),
      startEdit: jest.fn(),
      updateEditBody: jest.fn(),
    },
    changes: { deletedPostIds: {}, updatedPostsById: {} },
    state: {
      owner: createPostOwnerControlsState(),
      report: createReportPostState(),
    },
  };
}
