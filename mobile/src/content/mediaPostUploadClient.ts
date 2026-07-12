import type { PickedPostMedia } from './mediaPostSelection';

export type SignedMediaUpload = {
  readonly headers: ReadonlyArray<{
    readonly name: string;
    readonly value: string;
  }>;
  readonly method: 'PUT' | 'POST';
  readonly url: string;
};

export type MediaAssetProcessingState =
  | 'PENDING_UPLOAD'
  | 'UPLOADED'
  | 'PROCESSED'
  | 'FAILED'
  | '%future added value';

export type MediaAssetPollResult = {
  readonly processingState: MediaAssetProcessingState;
};

export type MediaPostUploadErrorCode =
  | 'aborted'
  | 'asset_missing'
  | 'processing_failed'
  | 'processing_timeout'
  | 'processing_unavailable'
  | 'upload_rejected'
  | 'upload_failed';

export class MediaPostUploadError extends Error {
  readonly code: MediaPostUploadErrorCode;

  constructor(code: MediaPostUploadErrorCode, message: string) {
    super(message);
    this.name = 'MediaPostUploadError';
    this.code = code;
  }
}

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type ReadSelectionBody = (
  selection: PickedPostMedia,
  signal: AbortSignal,
) => Promise<BodyInit>;

type LocalMediaFile = {
  readonly bytes: () => Promise<Uint8Array<ArrayBuffer>>;
};

type OpenLocalMediaFile = (
  uri: string,
) => LocalMediaFile | Promise<LocalMediaFile>;

export async function uploadSignedMedia({
  fetchImpl = fetch,
  readSelectionBody = readPickedMediaBody,
  selection,
  signal,
  signedUpload,
}: {
  readonly fetchImpl?: FetchImplementation;
  readonly readSelectionBody?: ReadSelectionBody;
  readonly selection: PickedPostMedia;
  readonly signal: AbortSignal;
  readonly signedUpload: SignedMediaUpload;
}): Promise<void> {
  throwIfAborted(signal);

  try {
    const body = await readSelectionBody(selection, signal);
    throwIfAborted(signal);

    const response = await fetchImpl(signedUpload.url, {
      body,
      headers: signedUpload.headers.map(
        ({ name, value }): [string, string] => [name, value],
      ),
      method: signedUpload.method,
      signal,
    });

    if (!response.ok) {
      throw uploadFailedError();
    }
  } catch (error) {
    if (isAbort(error, signal)) {
      throw abortedError();
    }

    if (error instanceof MediaPostUploadError) {
      throw error;
    }

    throw uploadFailedError();
  }
}

export async function pollMediaAssetUntilTerminal({
  assetId,
  delay = abortableDelay,
  fetchAsset,
  maxAttempts = 60,
  signal,
}: {
  readonly assetId: string;
  readonly delay?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  readonly fetchAsset: (
    assetId: string,
    signal: AbortSignal,
  ) => Promise<MediaAssetPollResult | null>;
  readonly maxAttempts?: number;
  readonly signal: AbortSignal;
}): Promise<MediaAssetPollResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    throwIfAborted(signal);

    let asset: MediaAssetPollResult | null;

    try {
      asset = await fetchAsset(assetId, signal);
    } catch (error) {
      if (isAbort(error, signal)) {
        throw abortedError();
      }

      throw new MediaPostUploadError(
        'processing_unavailable',
        'We could not check media processing. Try again.',
      );
    }

    throwIfAborted(signal);

    if (asset === null) {
      throw new MediaPostUploadError(
        'asset_missing',
        'This media is no longer available.',
      );
    }

    if (asset.processingState === 'PROCESSED') {
      return asset;
    }

    if (asset.processingState === 'FAILED') {
      throw new MediaPostUploadError(
        'processing_failed',
        'This media could not be processed.',
      );
    }

    if (attempt < maxAttempts) {
      try {
        await delay(1000, signal);
      } catch (error) {
        if (isAbort(error, signal)) {
          throw abortedError();
        }

        throw error;
      }
    }
  }

  throw new MediaPostUploadError(
    'processing_timeout',
    'Media processing is taking longer than expected. Try again.',
  );
}

export async function readPickedMediaBody(
  selection: PickedPostMedia,
  signal: AbortSignal,
  openFile: OpenLocalMediaFile = openExpoFile,
): Promise<BodyInit> {
  throwIfAborted(signal);
  const file = await openFile(selection.uri);
  const bytes = await file.bytes();
  throwIfAborted(signal);
  return bytes;
}

async function openExpoFile(uri: string): Promise<LocalMediaFile> {
  const { File } = await import('expo-file-system');
  return new File(uri);
}

export function normalizeMediaAssetProcessingState(
  state: string,
): MediaAssetProcessingState {
  if (
    state === 'PENDING_UPLOAD' ||
    state === 'UPLOADED' ||
    state === 'PROCESSED' ||
    state === 'FAILED' ||
    state === '%future added value'
  ) {
    return state;
  }

  throw new Error('Unsupported media processing state.');
}

const TERMINAL_FINALIZE_ERRORS = new Set([
  'content_type_mismatch',
  'empty_upload',
  'invalid_content_length',
  'invalid_id',
  'invalid_storage_key',
  'invalid_type',
  'not_found',
  'processing_failed',
  'unsupported_mime_type',
  'upload_too_large',
]);

export function finalizeUploadPayloadError(
  errors: ReadonlyArray<{ readonly message: string }>,
): Error {
  const isTerminal = errors.some(({ message }) =>
    TERMINAL_FINALIZE_ERRORS.has(message.trim().toLowerCase()),
  );

  if (isTerminal) {
    return new MediaPostUploadError(
      'upload_rejected',
      'This upload cannot be processed. Choose the media and try again.',
    );
  }

  return new Error('Media finalization is temporarily unavailable.');
}

function abortableDelay(
  milliseconds: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortedError());
      return;
    }

    const timeout = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(abortedError());
      },
      { once: true },
    );
  });
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw abortedError();
  }
}

function isAbort(error: unknown, signal: AbortSignal): boolean {
  return (
    signal.aborted ||
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof MediaPostUploadError && error.code === 'aborted')
  );
}

function abortedError(): MediaPostUploadError {
  return new MediaPostUploadError(
    'aborted',
    'Media publishing was cancelled.',
  );
}

function uploadFailedError(): MediaPostUploadError {
  return new MediaPostUploadError(
    'upload_failed',
    'We could not upload this media. Try again.',
  );
}
