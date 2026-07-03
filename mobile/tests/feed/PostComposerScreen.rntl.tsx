import type { ReactElement } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import ComposeRoute from '../../app/(app)/compose';
import { PostComposerScreen } from '../../src/feed/PostComposerScreen';

type CreatePostCommitConfig = {
  onCompleted?: (payload: {
    createPost?: {
      errors: { field?: string | null; message: string }[];
      post: { id: string } | null;
    } | null;
  }) => void;
  onError?: () => void;
  variables: unknown;
};

const mockRouter = {
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  replace: jest.fn(),
};
const mockCreatePostCommit =
  jest.fn<undefined, [CreatePostCommitConfig]>();
let mockCreatePostInFlight = false;

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('react-relay', () => ({
  graphql: jest.fn((query: TemplateStringsArray) => query),
  useMutation: () => [mockCreatePostCommit, mockCreatePostInFlight],
}));

describe('PostComposerScreen with React Native Testing Library', () => {
  beforeEach(() => {
    mockRouter.back.mockClear();
    mockRouter.canGoBack.mockReset();
    mockRouter.canGoBack.mockReturnValue(true);
    mockRouter.replace.mockClear();
    mockCreatePostCommit.mockClear();
    mockCreatePostInFlight = false;
  });

  test('keeps compose route pointed at the post composer screen', () => {
    const element = ComposeRoute() as ReactElement;

    expect(element.type).toBe(PostComposerScreen);
  });

  test('keeps submit disabled until the body is valid', async () => {
    const user = userEvent.setup();

    await render(<PostComposerScreen />);

    expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();

    await user.type(
      screen.getByLabelText('Post body'),
      '  hello from mobile  ',
      { skipBlur: true },
    );

    expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled();
    expect(screen.getByText('17/5000')).toBeOnTheScreen();

    await fireEvent.changeText(
      screen.getByLabelText('Post body'),
      'x'.repeat(5001),
    );

    expect(
      screen.getByText('Posts must be 5,000 characters or fewer.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();
  });

  test('counts emoji as backend graphemes in the body counter', async () => {
    await render(<PostComposerScreen />);

    await fireEvent.changeText(screen.getByLabelText('Post body'), '😀😀😀');

    expect(screen.getByText('3/5000')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled();
  });

  test('shows empty validation after the body field is touched', async () => {
    await render(<PostComposerScreen />);

    await fireEvent(screen.getByLabelText('Post body'), 'blur');

    expect(screen.getByText('Add text before posting.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();
  });

  test('marks active kind and visibility controls as selected', async () => {
    const user = userEvent.setup();

    await render(<PostComposerScreen />);

    expect(screen.getByRole('button', { name: 'Standard' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Story' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'Followers' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Public' })).not.toBeSelected();

    await user.press(screen.getByRole('button', { name: 'Story' }));
    await user.press(screen.getByRole('button', { name: 'Public' }));

    expect(screen.getByRole('button', { name: 'Standard' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'Story' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Followers' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'Public' })).toBeSelected();
  });

  test('commits createPost with trimmed input values', async () => {
    const user = userEvent.setup();

    await render(<PostComposerScreen />);

    await user.type(screen.getByLabelText('Post body'), '  Story update  ', {
      skipBlur: true,
    });
    await user.press(screen.getByRole('button', { name: 'Story' }));
    await user.press(screen.getByRole('button', { name: 'Public' }));
    await user.press(screen.getByRole('button', { name: 'Post' }));

    expect(mockCreatePostCommit).toHaveBeenCalledTimes(1);
    expect(mockCreatePostCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: {
            bodyText: 'Story update',
            kind: 'STORY',
            visibility: 'PUBLIC',
          },
        },
      }),
    );
  });

  test('blocks duplicate submissions and cancel before rerender', async () => {
    const user = userEvent.setup();

    await render(<PostComposerScreen />);

    await user.type(screen.getByLabelText('Post body'), 'Duplicate guard', {
      skipBlur: true,
    });

    const postButton = screen.getByRole('button', { name: 'Post' });
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });

    await fireEvent.press(postButton);
    await fireEvent.press(postButton);
    await fireEvent.press(cancelButton);

    expect(mockCreatePostCommit).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  test('freezes draft controls while createPost is in flight', async () => {
    const user = userEvent.setup();

    await render(<PostComposerScreen />);

    await user.type(screen.getByLabelText('Post body'), 'Original post body', {
      skipBlur: true,
    });
    await user.press(screen.getByRole('button', { name: 'Story' }));
    await user.press(screen.getByRole('button', { name: 'Public' }));

    const bodyInput = screen.getByLabelText('Post body');
    const standardButton = screen.getByRole('button', { name: 'Standard' });
    const followersButton = screen.getByRole('button', { name: 'Followers' });

    await fireEvent.press(screen.getByRole('button', { name: 'Post' }));
    await fireEvent.changeText(bodyInput, 'Edited while posting');
    await fireEvent.press(standardButton);
    await fireEvent.press(followersButton);

    expect(screen.getByLabelText('Post body')).toHaveDisplayValue(
      'Original post body',
    );
    expect(screen.getByLabelText('Post body')).toHaveProp('editable', false);
    expect(screen.getByRole('button', { name: 'Standard' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Standard' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'Story' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Story' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Followers' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Followers' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'Public' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Public' })).toBeSelected();
  });

  test('shows confirmation and returns home after successful creation', async () => {
    const user = userEvent.setup();

    await render(<PostComposerScreen />);

    await user.type(screen.getByLabelText('Post body'), 'Successful post', {
      skipBlur: true,
    });
    await user.press(screen.getByRole('button', { name: 'Post' }));

    await completeCreatePost({
      errors: [],
      post: { id: 'post-1' },
    });

    await waitFor(() => {
      expect(screen.getByText('Post created.')).toBeOnTheScreen();
    });
    expect(mockRouter.replace).toHaveBeenCalledWith('/home');
  });

  test('ignores createPost callbacks after the composer unmounts', async () => {
    const user = userEvent.setup();
    const view = await render(<PostComposerScreen />);

    await user.type(screen.getByLabelText('Post body'), 'Leave before callback', {
      skipBlur: true,
    });
    await user.press(screen.getByRole('button', { name: 'Post' }));

    await view.unmount();

    await completeCreatePost({
      errors: [],
      post: { id: 'post-1' },
    });

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test('keeps payload errors retryable without losing the draft body', async () => {
    const user = userEvent.setup();

    await render(<PostComposerScreen />);

    await user.type(screen.getByLabelText('Post body'), 'Retry this post', {
      skipBlur: true,
    });
    await user.press(screen.getByRole('button', { name: 'Post' }));

    await completeCreatePost({
      errors: [{ field: null, message: 'unauthenticated' }],
      post: null,
    });

    expect(
      screen.getByText('Sign in again to create a post.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Post body')).toHaveDisplayValue(
      'Retry this post',
    );
    expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled();

    await user.press(screen.getByRole('button', { name: 'Post' }));

    expect(mockCreatePostCommit).toHaveBeenCalledTimes(2);
  });

  test('keeps network errors retryable without losing the draft body', async () => {
    const user = userEvent.setup();

    await render(<PostComposerScreen />);

    await user.type(
      screen.getByLabelText('Post body'),
      'Retry after network error',
      {
        skipBlur: true,
      },
    );
    await user.press(screen.getByRole('button', { name: 'Post' }));

    const config = mockCreatePostCommit.mock.calls[0]?.[0];

    await act(() => {
      config?.onError?.();
    });

    expect(screen.getByText('We could not create this post.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Post body')).toHaveDisplayValue(
      'Retry after network error',
    );
    expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled();

    await user.press(screen.getByRole('button', { name: 'Post' }));

    expect(mockCreatePostCommit).toHaveBeenCalledTimes(2);
  });

  test('cancels through router back', async () => {
    const user = userEvent.setup();

    await render(<PostComposerScreen />);

    await user.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test('cancels direct compose routes by replacing home', async () => {
    const user = userEvent.setup();

    mockRouter.canGoBack.mockReturnValue(false);

    await render(<PostComposerScreen />);

    await user.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/home');
  });
});

async function completeCreatePost(
  createPost: NonNullable<
    Parameters<NonNullable<CreatePostCommitConfig['onCompleted']>>[0]['createPost']
  >,
) {
  const config = mockCreatePostCommit.mock.calls[0]?.[0];

  expect(config).toBeDefined();

  await act(() => {
    config?.onCompleted?.({ createPost });
  });
}
