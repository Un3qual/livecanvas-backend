import { render, screen, userEvent } from '@testing-library/react-native';

import { StoryViewerScreen } from '../../src/content/story/StoryViewerScreen';
import { storyHref } from '../../src/content/story/storyNavigation';

let mockBack: jest.Mock;
let mockQueryData: ReturnType<typeof storyViewerData> | { node: null };
let mockQueryShouldSuspend: boolean;
let mockQueryVariables: Array<{ id: string; storyFirst: number }>;
let mockReplacedRoutes: unknown[];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: (route: unknown) => mockReplacedRoutes.push(route),
  }),
}));

jest.mock('react-relay', () => ({
  graphql: jest.fn((query: TemplateStringsArray) => query.join('')),
  useLazyLoadQuery: (
    _query: unknown,
    variables: { id: string; storyFirst: number },
  ) => {
    mockQueryVariables.push(variables);
    if (mockQueryShouldSuspend) {
      throw new Promise(() => undefined);
    }
    return mockQueryData;
  },
}));

jest.mock('../../src/content/ContentMediaAssetView', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );

  return {
    ContentMediaAssetView: ({
      asset,
    }: {
      asset: { id: string; publicUrl: string | null };
    }) => <Text testID={`story-media-${asset.id}`}>{asset.publicUrl}</Text>,
  };
});

beforeEach(() => {
  mockBack = jest.fn();
  mockQueryData = storyViewerData('story-2');
  mockQueryShouldSuspend = false;
  mockQueryVariables = [];
  mockReplacedRoutes = [];
});

describe('StoryViewerScreen', () => {
  test('renders the loading boundary while Relay suspends', async () => {
    mockQueryShouldSuspend = true;

    await render(<StoryViewerScreen storyId="story-2" />);

    expect(screen.getByText('Loading story...')).toBeOnTheScreen();
  });

  test('renders unavailable state when the opaque node cannot be selected', async () => {
    mockQueryData = { node: null };

    await render(<StoryViewerScreen storyId="missing-story" />);

    expect(
      screen.getByText('This story is no longer available.'),
    ).toBeOnTheScreen();
    await userEvent.setup().press(
      screen.getByRole('button', { name: 'Close story' }),
    );
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test('renders a middle story, progress, media, and opaque previous/next routes', async () => {
    const user = userEvent.setup();

    await render(<StoryViewerScreen storyId="story-2" />);

    expect(mockQueryVariables).toEqual([{ id: 'story-2', storyFirst: 100 }]);
    expect(screen.getByText('2 of 3')).toBeOnTheScreen();
    expect(screen.getByText('Story story-2')).toBeOnTheScreen();
    expect(screen.getByTestId('story-media-story-2-media')).toHaveTextContent(
      'https://media.example.test/story-2.jpg',
    );

    await user.press(screen.getByRole('button', { name: 'Previous story' }));
    await user.press(screen.getByRole('button', { name: 'Next story' }));
    await user.press(screen.getByRole('button', { name: 'Close story' }));

    expect(mockReplacedRoutes).toEqual([
      storyHref('story-1'),
      storyHref('story-3'),
    ]);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test('disables only the unavailable boundary action for first and last stories', async () => {
    mockQueryData = storyViewerData('story-1');
    const view = await render(<StoryViewerScreen storyId="story-1" />);

    expect(screen.getByText('1 of 3')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Previous story' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Next story' }),
    ).not.toBeDisabled();

    mockQueryData = storyViewerData('story-3');
    await view.rerender(<StoryViewerScreen storyId="story-3" />);

    expect(screen.getByText('3 of 3')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Previous story' }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Next story' }),
    ).toBeDisabled();
  });
});

function storyViewerData(selectedId: string) {
  const stories = ['story-1', 'story-2', 'story-3'].map(story);
  const selectedStory = stories.find((candidate) => candidate.id === selectedId);

  if (!selectedStory) {
    return { node: null };
  }

  return {
    node: {
      ...selectedStory,
      __typename: 'Post' as const,
      author: {
        ...selectedStory.author,
        storyFeed: {
          edges: stories.map((node) => ({ node })),
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      },
    },
  };
}

function story(id: string) {
  return {
    author: { email: 'creator@example.test', id: 'author-id' },
    bodyText: `Story ${id}`,
    expiresAt: '2099-07-15T12:00:00.000Z',
    id,
    insertedAt: '2026-07-14T10:00:00.000Z',
    kind: 'STORY' as const,
    mediaAssets: [
      {
        id: `${id}-media`,
        mimeType: 'image/jpeg',
        processingState: 'PROCESSED' as const,
        publicUrl: `https://media.example.test/${id}.jpg`,
      },
    ],
    visibility: 'PUBLIC' as const,
  };
}
