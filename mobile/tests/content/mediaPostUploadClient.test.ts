import { describe, expect, test } from 'bun:test';

import {
  MediaPostUploadError,
  finalizeUploadPayloadError,
  normalizeMediaAssetProcessingState,
  pollMediaAssetUntilTerminal,
  readPickedMediaBody,
  uploadSignedMedia,
  type MediaAssetProcessingState,
  type SignedMediaUpload,
} from '../../src/content/mediaPostUploadClient';
import type { PickedPostMedia } from '../../src/content/mediaPostSelection';

const selection: PickedPostMedia = {
  fileName: 'photo.jpg',
  fileSize: 1024,
  mediaKind: 'image',
  mimeType: 'image/jpeg',
  uri: 'file:///photo.jpg',
};

const signedUpload: SignedMediaUpload = {
  headers: [
    { name: 'content-type', value: 'image/jpeg' },
    { name: 'if-none-match', value: '*' },
    { name: 'x-storage-signature', value: 'signed-value' },
  ],
  method: 'PUT',
  url: 'https://uploads.example.test/photo.jpg',
};

describe('uploadSignedMedia', () => {
  test('reads device-local picker URIs through the native file API', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    let openedUri: string | null = null;

    await expect(
      readPickedMediaBody(selection, new AbortController().signal, (uri) => {
        openedUri = uri;
        return { bytes: () => Promise.resolve(bytes) };
      }),
    ).resolves.toEqual(bytes);

    expect(String(openedUri)).toBe('file:///photo.jpg');
  });

  test('uses PUT or POST with the raw body and exactly the signed headers', async () => {
    for (const method of ['PUT', 'POST'] as const) {
      const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
      const rawBody = new Blob(['raw-binary']);
      const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ input, init });
        return Promise.resolve(new Response(null, { status: 204 }));
      }) as typeof fetch;

      await expect(
        uploadSignedMedia({
          fetchImpl,
          readSelectionBody: () => Promise.resolve(rawBody),
          selection,
          signal: new AbortController().signal,
          signedUpload: { ...signedUpload, method },
        }),
      ).resolves.toBeUndefined();

      expect(calls).toEqual([
        {
          input: signedUpload.url,
          init: {
            body: rawBody,
            headers: signedUpload.headers.map(({ name, value }) => [
              name,
              value,
            ]),
            method,
            signal: expect.any(AbortSignal),
          },
        },
      ]);

      const headers = calls[0]?.init?.headers as ReadonlyArray<
        readonly [string, string]
      >;
      expect(headers.some(([name]) => name.toLowerCase() === 'authorization')).toBe(
        false,
      );
    }
  });

  test('reports non-2xx responses and transport loss as retryable pre-confirmation failures', async () => {
    const httpFetch = (() =>
      Promise.resolve(new Response(null, { status: 412 }))) as typeof fetch;

    await expect(
      uploadSignedMedia({
        fetchImpl: httpFetch,
        readSelectionBody: () => Promise.resolve(new Blob(['raw'])),
        selection,
        signal: new AbortController().signal,
        signedUpload,
      }),
    ).rejects.toEqual(
      new MediaPostUploadError(
        'upload_failed',
        'We could not upload this media. Try again.',
      ),
    );

    const transportFetch = (() =>
      Promise.reject(new TypeError('network detail'))) as typeof fetch;

    await expect(
      uploadSignedMedia({
        fetchImpl: transportFetch,
        readSelectionBody: () => Promise.resolve(new Blob(['raw'])),
        selection,
        signal: new AbortController().signal,
        signedUpload,
      }),
    ).rejects.toEqual(
      new MediaPostUploadError(
        'upload_failed',
        'We could not upload this media. Try again.',
      ),
    );
  });

  test('propagates cancellation without converting it to a retryable upload failure', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      uploadSignedMedia({
        fetchImpl: (() =>
          Promise.reject(
            new DOMException('Aborted', 'AbortError'),
          )) as typeof fetch,
        readSelectionBody: () => Promise.resolve(new Blob(['raw'])),
        selection,
        signal: controller.signal,
        signedUpload,
      }),
    ).rejects.toEqual(
      new MediaPostUploadError('aborted', 'Media publishing was cancelled.'),
    );
  });
});

describe('media upload response normalization', () => {
  test('keeps Relay future enum values nonterminal so polling can continue', () => {
    expect(normalizeMediaAssetProcessingState('%future added value')).toBe(
      '%future added value',
    );
  });

  test('classifies deterministic finalization payload errors as fresh-upload failures', () => {
    expect(finalizeUploadPayloadError([{ message: 'empty_upload' }])).toEqual(
      new MediaPostUploadError(
        'upload_rejected',
        'This upload cannot be processed. Choose the media and try again.',
      ),
    );

    expect(finalizeUploadPayloadError([{ message: 'storage_unavailable' }])).toEqual(
      new Error('Media finalization is temporarily unavailable.'),
    );
  });
});

describe('pollMediaAssetUntilTerminal', () => {
  test('polls pending and uploaded states until the asset is processed', async () => {
    const states: MediaAssetProcessingState[] = [
      'PENDING_UPLOAD',
      'UPLOADED',
      'PROCESSED',
    ];
    const delays: number[] = [];

    await expect(
      pollMediaAssetUntilTerminal({
        assetId: 'opaque-id',
        delay: (milliseconds) => {
          delays.push(milliseconds);
          return Promise.resolve();
        },
        fetchAsset: () => {
          const processingState = states.shift();

          return processingState
            ? Promise.resolve({ processingState })
            : Promise.reject(new Error('Missing test processing state.'));
        },
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({ processingState: 'PROCESSED' });

    expect(delays).toEqual([1000, 1000]);
  });

  test('fails terminally for failed or missing assets', async () => {
    await expect(
      pollMediaAssetUntilTerminal({
        assetId: 'failed-id',
        delay: () => Promise.resolve(),
        fetchAsset: () => Promise.resolve({ processingState: 'FAILED' }),
        signal: new AbortController().signal,
      }),
    ).rejects.toEqual(
      new MediaPostUploadError(
        'processing_failed',
        'This media could not be processed.',
      ),
    );

    await expect(
      pollMediaAssetUntilTerminal({
        assetId: 'missing-id',
        delay: () => Promise.resolve(),
        fetchAsset: () => Promise.resolve(null),
        signal: new AbortController().signal,
      }),
    ).rejects.toEqual(
      new MediaPostUploadError(
        'asset_missing',
        'This media is no longer available.',
      ),
    );
  });

  test('times out after the final pending response without an extra delay', async () => {
    let fetchCount = 0;
    let delayCount = 0;

    await expect(
      pollMediaAssetUntilTerminal({
        assetId: 'pending-id',
        delay: () => {
          delayCount += 1;
          return Promise.resolve();
        },
        fetchAsset: () => {
          fetchCount += 1;
          return Promise.resolve({ processingState: 'UPLOADED' });
        },
        maxAttempts: 3,
        signal: new AbortController().signal,
      }),
    ).rejects.toEqual(
      new MediaPostUploadError(
        'processing_timeout',
        'Media processing is taking longer than expected. Try again.',
      ),
    );

    expect(fetchCount).toBe(3);
    expect(delayCount).toBe(2);
  });

  test('stops polling immediately when cancelled', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      pollMediaAssetUntilTerminal({
        assetId: 'cancelled-id',
        delay: () => Promise.resolve(),
        fetchAsset: () => Promise.resolve({ processingState: 'UPLOADED' }),
        signal: controller.signal,
      }),
    ).rejects.toEqual(
      new MediaPostUploadError('aborted', 'Media publishing was cancelled.'),
    );
  });
});
