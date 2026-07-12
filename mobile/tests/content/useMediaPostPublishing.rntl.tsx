import { useState } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import {
  MediaPostUploadError,
  type SignedMediaUpload,
} from '../../src/content/mediaPostUploadClient';
import {
  useMediaPostPublishing,
  type MediaPostPublishingDependencies,
} from '../../src/content/useMediaPostPublishing';
import type { PickedPostMedia } from '../../src/content/mediaPostSelection';

let mockAuthStatus: 'authenticated' | 'unauthenticated' = 'authenticated';
let mockBeforeUnauthenticated: (() => void | Promise<void>) | null = null;

jest.mock('react-relay', () => ({
  fetchQuery: jest.fn(),
  graphql: jest.fn((query: TemplateStringsArray) => query),
  useMutation: () => [jest.fn(), false],
  useRelayEnvironment: () => ({}),
}));

jest.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    registerBeforeUnauthenticated: (
      callback: () => void | Promise<void>,
    ) => {
      mockBeforeUnauthenticated = callback;
      return () => {
        if (mockBeforeUnauthenticated === callback) {
          mockBeforeUnauthenticated = null;
        }
      };
    },
    state:
      mockAuthStatus === 'authenticated'
        ? {
            status: 'authenticated',
            tokens: {
              accessToken: 'access',
              expiresAt: '2099-01-01T00:00:00Z',
              refreshToken: 'refresh',
            },
          }
        : { status: 'unauthenticated' },
  }),
}));

const selection: PickedPostMedia = {
  fileName: 'photo.jpg',
  fileSize: 1024,
  mediaKind: 'image',
  mimeType: 'image/jpeg',
  uri: 'file:///photo.jpg',
};

const signedUpload: SignedMediaUpload = {
  headers: [{ name: 'content-type', value: 'image/jpeg' }],
  method: 'PUT',
  url: 'https://uploads.example.test/photo.jpg',
};

function createDependencies(
  overrides: Partial<MediaPostPublishingDependencies> = {},
): MediaPostPublishingDependencies {
  return {
    createPost: jest.fn(() =>
      Promise.resolve({ errors: [], postId: 'post-id' }),
    ),
    delay: () => Promise.resolve(),
    fetchAsset: jest.fn(() => Promise.resolve({
      processingState: 'PROCESSED' as const,
    })),
    finalizeUpload: jest.fn(() => Promise.resolve({
      processingState: 'PROCESSED' as const,
    })),
    pickMedia: jest.fn(() => Promise.resolve(selection)),
    requestUpload: jest.fn(() => Promise.resolve({
      mediaAssetId: 'asset-id',
      signedUpload,
    })),
    upload: jest.fn(() => Promise.resolve()),
    ...overrides,
  };
}

function Harness({
  dependencies,
}: {
  dependencies: MediaPostPublishingDependencies;
}) {
  const media = useMediaPostPublishing({ dependencies });
  const [, forceRender] = useState(0);

  return (
    <>
      <Text testID="stage">{media.state.stage}</Text>
      <Text testID="asset-id">{media.state.mediaAssetId ?? 'none'}</Text>
      <Text testID="error">{media.state.errorMessage ?? 'none'}</Text>
      <Pressable accessibilityRole="button" onPress={media.selectMedia}>
        <Text>Select</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={media.retryMedia}>
        <Text>Retry</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={media.removeMedia}>
        <Text>Remove</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={media.cancel}>
        <Text>Cancel</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          media.submit({ kind: 'STANDARD', visibility: 'PUBLIC' });
        }}
      >
        <Text>Submit</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => forceRender((value) => value + 1)}
      >
        <Text>Rerender</Text>
      </Pressable>
    </>
  );
}

describe('useMediaPostPublishing', () => {
  beforeEach(() => {
    mockAuthStatus = 'authenticated';
    mockBeforeUnauthenticated = null;
  });

  test('runs request, raw upload, finalize, polling, and createPost once', async () => {
    const fetchAsset = jest
      .fn()
      .mockResolvedValueOnce({ processingState: 'UPLOADED' })
      .mockResolvedValueOnce({ processingState: 'PROCESSED' });
    let resolveCreatePost:
      | ((result: { errors: never[]; postId: string }) => void)
      | null = null;
    const createPost = jest.fn(
      () =>
        new Promise<{ errors: never[]; postId: string }>((resolve) => {
          resolveCreatePost = resolve;
        }),
    );
    const dependencies = createDependencies({
      createPost,
      fetchAsset,
      finalizeUpload: jest.fn(() => Promise.resolve({
        processingState: 'UPLOADED' as const,
      })),
    });

    await render(<Harness dependencies={dependencies} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Select' }));

    await waitFor(() => expect(screen.getByTestId('stage')).toHaveTextContent('ready'));
    expect(dependencies.requestUpload).toHaveBeenCalledTimes(1);
    expect(dependencies.upload).toHaveBeenCalledTimes(1);
    expect(dependencies.finalizeUpload).toHaveBeenCalledTimes(1);
    expect(fetchAsset).toHaveBeenCalledTimes(2);

    await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));

    expect(createPost).toHaveBeenCalledTimes(1);
    expect(createPost).toHaveBeenCalledWith(
      {
        input: {
          kind: 'STANDARD',
          mediaAssetIds: ['asset-id'],
          visibility: 'PUBLIC',
        },
        signal: expect.any(AbortSignal),
      },
    );

    await act(async () => {
      resolveCreatePost?.({ errors: [], postId: 'post-id' });
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(screen.getByTestId('stage')).toHaveTextContent('succeeded'),
    );
  });

  test('uses a fresh asset when retrying an indeterminate pre-2xx upload', async () => {
    const requestUpload = jest
      .fn()
      .mockResolvedValueOnce({ mediaAssetId: 'asset-1', signedUpload })
      .mockResolvedValueOnce({ mediaAssetId: 'asset-2', signedUpload });
    const upload = jest
      .fn()
      .mockRejectedValueOnce(
        new MediaPostUploadError(
          'upload_failed',
          'We could not upload this media. Try again.',
        ),
      )
      .mockImplementationOnce(() => Promise.resolve());
    const dependencies = createDependencies({ requestUpload, upload });

    await render(<Harness dependencies={dependencies} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Select' }));

    await waitFor(() => expect(screen.getByTestId('stage')).toHaveTextContent('failed'));
    expect(screen.getByTestId('asset-id')).toHaveTextContent('asset-1');

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByTestId('stage')).toHaveTextContent('ready'));
    expect(requestUpload).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('asset-id')).toHaveTextContent('asset-2');
  });

  test('retains the same asset after confirmed 2xx and retries ambiguous finalization', async () => {
    const finalizeUpload = jest
      .fn()
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce({ processingState: 'PROCESSED' });
    const fetchAsset = jest.fn(() => Promise.resolve({
      processingState: 'PENDING_UPLOAD' as const,
    }));
    const dependencies = createDependencies({ fetchAsset, finalizeUpload });

    await render(<Harness dependencies={dependencies} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Select' }));

    await waitFor(() => expect(screen.getByTestId('stage')).toHaveTextContent('ready'));
    expect(dependencies.requestUpload).toHaveBeenCalledTimes(1);
    expect(finalizeUpload).toHaveBeenCalledTimes(2);
    expect(finalizeUpload.mock.calls[0]?.[0].mediaAssetId).toBe('asset-id');
    expect(finalizeUpload.mock.calls[1]?.[0].mediaAssetId).toBe('asset-id');
  });

  test('requests a fresh asset after deterministic finalization rejection', async () => {
    const requestUpload = jest
      .fn()
      .mockResolvedValueOnce({ mediaAssetId: 'rejected-id', signedUpload })
      .mockResolvedValueOnce({ mediaAssetId: 'fresh-id', signedUpload });
    const finalizeUpload = jest
      .fn()
      .mockRejectedValueOnce(
        new MediaPostUploadError(
          'upload_rejected',
          'This upload cannot be processed. Choose the media and try again.',
        ),
      )
      .mockResolvedValueOnce({ processingState: 'PROCESSED' });
    const dependencies = createDependencies({ finalizeUpload, requestUpload });

    await render(<Harness dependencies={dependencies} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Select' }));

    await waitFor(() => expect(screen.getByTestId('stage')).toHaveTextContent('failed'));
    expect(screen.getByTestId('asset-id')).toHaveTextContent('none');

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByTestId('stage')).toHaveTextContent('ready'));
    expect(requestUpload).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('asset-id')).toHaveTextContent('fresh-id');
  });

  test('preserves the ready asset after createPost payload errors', async () => {
    const createPost = jest
      .fn()
      .mockResolvedValueOnce({
        errors: [{ field: null, message: 'unauthenticated' }],
        postId: null,
      })
      .mockResolvedValueOnce({ errors: [], postId: 'post-id' });
    const dependencies = createDependencies({ createPost });

    await render(<Harness dependencies={dependencies} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Select' }));
    await waitFor(() => expect(screen.getByTestId('stage')).toHaveTextContent('ready'));

    await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(screen.getByTestId('stage')).toHaveTextContent('ready'));
    expect(screen.getByTestId('asset-id')).toHaveTextContent('asset-id');

    await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() =>
      expect(screen.getByTestId('stage')).toHaveTextContent('succeeded'),
    );
    expect(createPost).toHaveBeenCalledTimes(2);
  });

  test('keeps the ready asset when replacement selection is cancelled', async () => {
    const pickMedia = jest
      .fn()
      .mockResolvedValueOnce(selection)
      .mockResolvedValueOnce(null);
    const dependencies = createDependencies({ pickMedia });

    await render(<Harness dependencies={dependencies} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Select' }));
    await waitFor(() => expect(screen.getByTestId('stage')).toHaveTextContent('ready'));

    await fireEvent.press(screen.getByRole('button', { name: 'Select' }));
    await waitFor(() => expect(pickMedia).toHaveBeenCalledTimes(2));

    expect(screen.getByTestId('stage')).toHaveTextContent('ready');
    expect(screen.getByTestId('asset-id')).toHaveTextContent('asset-id');
    expect(dependencies.requestUpload).toHaveBeenCalledTimes(1);
  });

  test('aborts active work on remove, auth loss, and unmount', async () => {
    const observedSignals: AbortSignal[] = [];
    const upload = jest.fn(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise<void>((_resolve, reject) => {
          observedSignals.push(signal);
          signal.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          });
        }),
    );
    const dependencies = createDependencies({ upload });
    const view = await render(<Harness dependencies={dependencies} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Select' }));
    await waitFor(() =>
      expect(screen.getByTestId('stage')).toHaveTextContent('uploading'),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
    expect(observedSignals[0]?.aborted).toBe(true);
    expect(screen.getByTestId('stage')).toHaveTextContent('idle');

    await fireEvent.press(screen.getByRole('button', { name: 'Select' }));
    await waitFor(() => expect(observedSignals).toHaveLength(2));
    mockAuthStatus = 'unauthenticated';
    await fireEvent.press(screen.getByRole('button', { name: 'Rerender' }));
    await waitFor(() => expect(observedSignals[1]?.aborted).toBe(true));

    mockAuthStatus = 'authenticated';
    await fireEvent.press(screen.getByRole('button', { name: 'Rerender' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Select' }));
    await waitFor(() => expect(observedSignals).toHaveLength(3));
    await view.unmount();
    expect(observedSignals[2]?.aborted).toBe(true);
  });
});
