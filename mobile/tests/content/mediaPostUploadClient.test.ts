import { describe, expect, test } from 'bun:test';

import {
  MediaPostUploadError,
  pollMediaAssetUntilTerminal,
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
  test('uses PUT or POST with the raw body and exactly the signed headers', async () => {
    for (const method of ['PUT', 'POST'] as const) {
      const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
      const rawBody = new Blob(['raw-binary']);
      const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ input, init });
        return new Response(null, { status: 204 });
      }) as typeof fetch;

      await expect(
        uploadSignedMedia({
          fetchImpl,
          readSelectionBody: async () => rawBody,
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
    const httpFetch = (async () =>
      new Response(null, { status: 412 })) as typeof fetch;

    await expect(
      uploadSignedMedia({
        fetchImpl: httpFetch,
        readSelectionBody: async () => new Blob(['raw']),
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

    const transportFetch = (async () => {
      throw new TypeError('network detail');
    }) as typeof fetch;

    await expect(
      uploadSignedMedia({
        fetchImpl: transportFetch,
        readSelectionBody: async () => new Blob(['raw']),
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
        fetchImpl: (async () => {
          throw new DOMException('Aborted', 'AbortError');
        }) as typeof fetch,
        readSelectionBody: async () => new Blob(['raw']),
        selection,
        signal: controller.signal,
        signedUpload,
      }),
    ).rejects.toEqual(
      new MediaPostUploadError('aborted', 'Media publishing was cancelled.'),
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
        delay: async (milliseconds) => {
          delays.push(milliseconds);
        },
        fetchAsset: async () => ({ processingState: states.shift()! }),
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({ processingState: 'PROCESSED' });

    expect(delays).toEqual([1000, 1000]);
  });

  test('fails terminally for failed or missing assets', async () => {
    await expect(
      pollMediaAssetUntilTerminal({
        assetId: 'failed-id',
        delay: async () => undefined,
        fetchAsset: async () => ({ processingState: 'FAILED' }),
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
        delay: async () => undefined,
        fetchAsset: async () => null,
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
        delay: async () => {
          delayCount += 1;
        },
        fetchAsset: async () => {
          fetchCount += 1;
          return { processingState: 'UPLOADED' };
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
        delay: async () => undefined,
        fetchAsset: async () => ({ processingState: 'UPLOADED' }),
        signal: controller.signal,
      }),
    ).rejects.toEqual(
      new MediaPostUploadError('aborted', 'Media publishing was cancelled.'),
    );
  });
});
