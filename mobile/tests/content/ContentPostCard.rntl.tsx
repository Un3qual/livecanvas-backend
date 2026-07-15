import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import {
  ContentPostCard,
  type ContentPost,
} from '../../src/content/ContentPostCard';
import { applyContentPostChanges } from '../../src/content/contentPostChanges';
import {
  usePostControls,
  type PostControls,
} from '../../src/content/usePostControls';

type MutationConfig = {
  readonly onCompleted?: (payload: Record<string, unknown>) => void;
  readonly onError?: () => void;
  readonly variables: Record<string, unknown>;
};

type MutationCommit = jest.Mock<void, [MutationConfig]>;

let mockReportCommit: MutationCommit;
let mockUpdateCommit: MutationCommit;
let mockDeleteCommit: MutationCommit;

jest.mock('../../src/content/ContentMediaAssetView', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );

  return {
    ContentMediaAssetView: ({
      asset,
    }: {
      asset: { id: string; publicUrl: string | null };
    }) => <Text testID={`content-media-${asset.id}`}>{asset.publicUrl}</Text>,
  };
});

jest.mock('react-relay', () => ({
  graphql: jest.fn((query: TemplateStringsArray) => query.join('')),
  useMutation: (mutation: unknown) => {
    const operation = mockRelayOperationName(mutation);

    if (operation.includes('UpdatePostMutation')) {
      return [mockUpdateCommit, false];
    }

    if (operation.includes('DeletePostMutation')) {
      return [mockDeleteCommit, false];
    }

    return [mockReportCommit, false];
  },
}));

function mockRelayOperationName(mutation: unknown): string {
  if (typeof mutation === 'string') {
    return mutation;
  }

  if (
    mutation !== null &&
    typeof mutation === 'object' &&
    'params' in mutation
  ) {
    const params = mutation.params as { readonly name?: unknown };

    if (typeof params.name === 'string') {
      return params.name;
    }
  }

  return '';
}

beforeEach(() => {
  mockReportCommit = jest.fn();
  mockUpdateCommit = jest.fn();
  mockDeleteCommit = jest.fn();
});

describe('ContentPostCard with shared controls', () => {
  test('renders validated media presentations through the shared media surface', async () => {
    const post = contentPost({
      authorId: 'viewer-id',
      id: 'opaque-post-id',
      mediaAssets: [
        {
          id: 'asset-id',
          mimeType: 'image/jpeg',
          processingState: 'PROCESSED',
          publicUrl: 'https://media.example.test/post.jpg',
        },
      ],
    });

    await render(<Harness post={post} viewerId="viewer-id" />);

    expect(screen.getByTestId('content-media-asset-id')).toHaveTextContent(
      'https://media.example.test/post.jpg',
    );
  });

  test('opens the author profile with the opaque author ID', async () => {
    const user = userEvent.setup();
    const onOpenAuthor = jest.fn();
    const post = contentPost({
      authorId: 'opaque-author-id',
      id: 'opaque-post-id',
    });

    await render(
      <Harness
        onOpenAuthor={onOpenAuthor}
        post={post}
        viewerId="viewer-id"
      />,
    );
    await user.press(
      screen.getByRole('button', {
        name: 'Open author profile for creator@example.com',
      }),
    );

    expect(onOpenAuthor).toHaveBeenCalledWith('opaque-author-id');
  });

  test('distinguishes fallback author actions by opaque profile ID', async () => {
    await render(<FallbackAuthorCollection />);

    expect(screen.getByText('Profile ID VXNlcjox')).toBeOnTheScreen();
    expect(screen.getByText('Profile ID VXNlcjoxMA==')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: 'Open author profile for LiveCanvas user, Profile ID VXNlcjox',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: 'Open author profile for LiveCanvas user, Profile ID VXNlcjoxMA==',
      }),
    ).toBeOnTheScreen();
  });

  test('keeps controller action identity stable while edit state changes', async () => {
    const user = userEvent.setup();
    const onActions = jest.fn();
    const post = contentPost({ authorId: 'viewer-id', id: 'opaque-post-id' });

    await render(
      <Harness post={post} viewerId="viewer-id" onActions={onActions} />,
    );
    await user.press(screen.getByRole('button', { name: 'Edit post' }));
    await user.type(screen.getByLabelText('Post body'), ' updated');

    const observedActions = onActions.mock.calls.map(([actions]) => actions);

    expect(observedActions[0]).toBeDefined();
    expect(new Set(observedActions).size).toBe(1);
  });

  test('updates an owned post with its opaque Relay ID', async () => {
    const user = userEvent.setup();
    const post = contentPost({ authorId: 'viewer-id', id: 'opaque-post-id' });

    const view = await render(<Harness post={post} viewerId="viewer-id" />);

    expect(screen.queryByRole('button', { name: 'Report post' })).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Edit post' }));
    await user.clear(screen.getByLabelText('Post body'));
    await user.type(screen.getByLabelText('Post body'), 'Updated body');
    await user.press(screen.getByRole('button', { name: 'Save post' }));

    expect(mockUpdateCommit).toHaveBeenCalledTimes(1);
    expect(mockUpdateCommit.mock.calls[0]?.[0].variables).toEqual({
      input: {
        bodyText: 'Updated body',
        postId: 'opaque-post-id',
        visibility: 'PUBLIC',
      },
    });

    await completeMutation(mockUpdateCommit, {
      updatePost: {
        errors: [],
        post: { ...post, bodyText: 'Updated body' },
      },
    });

    expect(screen.getByText('Updated body')).toBeOnTheScreen();
    expect(screen.queryByText('Original body')).toBeNull();

    await view.rerender(
      <Harness
        post={{ ...post, bodyText: 'Server newer body' }}
        viewerId="viewer-id"
      />,
    );

    expect(screen.getByText('Server newer body')).toBeOnTheScreen();
    expect(screen.queryByText('Updated body')).toBeNull();
  });

  test('deletes an owned post after confirmation', async () => {
    const user = userEvent.setup();
    const post = contentPost({ authorId: 'viewer-id', id: 'opaque-post-id' });

    await render(<Harness post={post} viewerId="viewer-id" />);
    await user.press(screen.getByRole('button', { name: 'Delete post' }));
    await user.press(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(mockDeleteCommit).toHaveBeenCalledTimes(1);
    expect(mockDeleteCommit.mock.calls[0]?.[0].variables).toEqual({
      input: { postId: 'opaque-post-id' },
    });

    await completeMutation(mockDeleteCommit, {
      deletePost: { deletedPostId: 'opaque-post-id', errors: [] },
    });

    expect(screen.getByText('Post removed.')).toBeOnTheScreen();
  });

  test('reports a non-owned post once across same-tick presses', async () => {
    const post = contentPost({ authorId: 'other-id', id: 'opaque-post-id' });

    await render(<Harness post={post} viewerId="viewer-id" />);
    const reportButton = screen.getByRole('button', { name: 'Report post' });
    await fireEvent.press(reportButton);
    await fireEvent.press(reportButton);

    expect(screen.queryByRole('button', { name: 'Edit post' })).toBeNull();
    expect(mockReportCommit).toHaveBeenCalledTimes(1);
    expect(mockReportCommit.mock.calls[0]?.[0].variables).toEqual({
      input: {
        details: null,
        postId: 'opaque-post-id',
        reason: 'SPAM',
      },
    });

    await completeMutation(mockReportCommit, {
      reportPost: {
        errors: [],
        report: { id: 'report-id' },
      },
    });

    expect(screen.getByText('Report submitted.')).toBeOnTheScreen();
  });

  test('disables sibling report actions while one report is pending', async () => {
    await render(<ReportCollection />);

    const reportButtons = screen.getAllByRole('button', { name: 'Report post' });
    await fireEvent.press(reportButtons[0]);

    expect(screen.getByRole('button', { name: 'Reporting...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Report post' })).toBeDisabled();
  });
});

function ReportCollection() {
  const controls = usePostControls({ viewerId: 'viewer-id' });

  return (
    <>
      <ContentPostCard
        controls={controls}
        onOpenAuthor={() => undefined}
        post={contentPost({ authorId: 'other-1', id: 'post-1' })}
        viewerId="viewer-id"
      />
      <ContentPostCard
        controls={controls}
        onOpenAuthor={() => undefined}
        post={contentPost({ authorId: 'other-2', id: 'post-2' })}
        viewerId="viewer-id"
      />
    </>
  );
}

function FallbackAuthorCollection() {
  const controls = usePostControls({ viewerId: 'viewer-id' });

  return (
    <>
      <ContentPostCard
        controls={controls}
        onOpenAuthor={() => undefined}
        post={contentPost({
          authorEmail: null,
          authorId: 'VXNlcjox',
          id: 'post-1',
        })}
        viewerId="viewer-id"
      />
      <ContentPostCard
        controls={controls}
        onOpenAuthor={() => undefined}
        post={contentPost({
          authorEmail: null,
          authorId: 'VXNlcjoxMA==',
          id: 'post-2',
        })}
        viewerId="viewer-id"
      />
    </>
  );
}

function Harness({
  onActions,
  onOpenAuthor = () => undefined,
  post,
  viewerId,
}: {
  onActions?: (actions: PostControls['actions']) => void;
  onOpenAuthor?: (authorId: string) => void;
  post: ContentPost;
  viewerId: string;
}) {
  const controls = usePostControls({ viewerId });
  const [visiblePost] = applyContentPostChanges([post], controls.changes);

  useEffect(() => {
    onActions?.(controls.actions);
  }, [controls.actions, onActions]);

  return visiblePost ? (
    <ContentPostCard
      controls={controls}
      onOpenAuthor={onOpenAuthor}
      post={visiblePost}
      viewerId={viewerId}
    />
  ) : (
    <Text>Post removed.</Text>
  );
}

function contentPost({
  authorEmail = 'creator@example.com',
  authorId,
  id,
  mediaAssets = [],
}: {
  authorEmail?: string | null;
  authorId: string;
  id: string;
  mediaAssets?: ContentPost['mediaAssets'];
}): ContentPost {
  return {
    author: { email: authorEmail, id: authorId },
    bodyText: 'Original body',
    expiresAt: null,
    id,
    insertedAt: '2026-07-09T12:00:00Z',
    kind: 'STANDARD',
    mediaAssets,
    visibility: 'PUBLIC',
  };
}

async function completeMutation(
  commit: MutationCommit,
  payload: Record<string, unknown>,
) {
  await act(() => {
    commit.mock.calls.at(-1)?.[0].onCompleted?.(payload);
  });
}
