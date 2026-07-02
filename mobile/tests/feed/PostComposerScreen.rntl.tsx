import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import { PostComposerScreen } from '../../src/feed/PostComposerScreen';

type CreatePostCommitConfig = {
  onCompleted?: (payload: unknown) => void;
  onError?: () => void;
  variables: unknown;
};

const mockRouter = {
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  replace: jest.fn(),
};
const mockCreatePostCommit = jest.fn<void, [CreatePostCommitConfig]>();
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
    expect(screen.getByText('17/5000')).toBeTruthy();
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

  test('shows confirmation and returns home after successful creation', async () => {
    const user = userEvent.setup();

    await render(<PostComposerScreen />);

    await user.type(screen.getByLabelText('Post body'), 'Successful post', {
      skipBlur: true,
    });
    await user.press(screen.getByRole('button', { name: 'Post' }));

    const config = mockCreatePostCommit.mock.calls[0]?.[0];

    expect(config).toBeDefined();

    await act(async () => {
      config?.onCompleted?.({
        createPost: {
          errors: [],
          post: { id: 'post-1' },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Post created.')).toBeTruthy();
    });
    expect(mockRouter.replace).toHaveBeenCalledWith('/home');
  });
});
