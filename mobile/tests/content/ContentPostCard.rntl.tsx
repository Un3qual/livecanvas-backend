import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  ContentPostCard,
  type ContentPost,
} from '../../src/content/ContentPostCard';
import { applyContentPostChanges } from '../../src/content/contentPostChanges';
import { usePostControls } from '../../src/content/usePostControls';

type MutationConfig = {
  readonly onCompleted?: (payload: Record<string, unknown>) => void;
  readonly onError?: () => void;
  readonly variables: Record<string, unknown>;
};

type MutationCommit = jest.Mock<void, [MutationConfig]>;

let mockReportCommit: MutationCommit;
let mockUpdateCommit: MutationCommit;
let mockDeleteCommit: MutationCommit;

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
  test('updates an owned post with its opaque Relay ID', async () => {
    const user = userEvent.setup();
    const post = contentPost({ authorId: 'viewer-id', id: 'opaque-post-id' });

    await render(<Harness post={post} viewerId="viewer-id" />);

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
});

function Harness({
  post,
  viewerId,
}: {
  post: ContentPost;
  viewerId: string;
}) {
  const controls = usePostControls({ viewerId });
  const [visiblePost] = applyContentPostChanges([post], controls.changes);

  return visiblePost ? (
    <ContentPostCard
      controls={controls}
      post={visiblePost}
      viewerId={viewerId}
    />
  ) : (
    <Text>Post removed.</Text>
  );
}

function contentPost({
  authorId,
  id,
}: {
  authorId: string;
  id: string;
}): ContentPost {
  return {
    author: { email: 'creator@example.com', id: authorId },
    bodyText: 'Original body',
    expiresAt: null,
    id,
    insertedAt: '2026-07-09T12:00:00Z',
    kind: 'STANDARD',
    mediaAssets: [],
    visibility: 'PUBLIC',
  };
}

async function completeMutation(
  commit: MutationCommit,
  payload: Record<string, unknown>,
) {
  await act(async () => {
    commit.mock.calls.at(-1)?.[0].onCompleted?.(payload);
  });
}
