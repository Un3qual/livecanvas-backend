import type { ImagePickerAsset } from 'expo-image-picker';

export const MEDIA_POST_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
] as const;

export type MediaPostMimeType = (typeof MEDIA_POST_MIME_TYPES)[number];
export type MediaPostKind = 'image' | 'video';

export type PickedPostMedia = {
  readonly file: Blob | null;
  readonly fileName: string | null;
  readonly fileSize: number | null;
  readonly mediaKind: MediaPostKind;
  readonly mimeType: MediaPostMimeType;
  readonly uri: string;
};

export type MediaPostPicker = Pick<
  typeof import('expo-image-picker'),
  'launchImageLibraryAsync' | 'requestMediaLibraryPermissionsAsync'
>;

export class MediaPostSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaPostSelectionError';
  }
}

const IMAGE_MAX_BYTES = 25 * 1024 * 1024;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
const PERMISSION_ERROR = 'Allow photo library access to select media.';
const PICKER_ERROR = 'We could not open your media library.';
const UNSUPPORTED_TYPE_ERROR = 'Choose a JPEG, PNG, WebP, or MP4 file.';

/** Opens only the device media library; the post composer never requests camera access. */
export async function pickPostMedia(
  picker?: MediaPostPicker,
): Promise<PickedPostMedia | null> {
  const resolvedPicker = picker ?? (await loadDefaultPicker());
  let permission: Awaited<
    ReturnType<MediaPostPicker['requestMediaLibraryPermissionsAsync']>
  >;

  try {
    permission = await resolvedPicker.requestMediaLibraryPermissionsAsync();
  } catch {
    throw new MediaPostSelectionError(PICKER_ERROR);
  }

  if (!permission.granted) {
    throw new MediaPostSelectionError(PERMISSION_ERROR);
  }

  let result: Awaited<
    ReturnType<MediaPostPicker['launchImageLibraryAsync']>
  >;

  try {
    result = await resolvedPicker.launchImageLibraryAsync({
      allowsEditing: false,
      allowsMultipleSelection: false,
      mediaTypes: ['images', 'videos'],
      quality: 1,
    });
  } catch {
    throw new MediaPostSelectionError(PICKER_ERROR);
  }

  if (result.canceled) {
    return null;
  }

  const asset = result.assets?.[0];

  if (!asset) {
    throw new MediaPostSelectionError(PICKER_ERROR);
  }

  return normalizePickedPostMedia(asset);
}

async function loadDefaultPicker(): Promise<MediaPostPicker> {
  try {
    return await import('expo-image-picker');
  } catch {
    throw new MediaPostSelectionError(PICKER_ERROR);
  }
}

function normalizePickedPostMedia(
  asset: ImagePickerAsset,
): PickedPostMedia {
  const mimeType = normalizeMimeType(
    asset.mimeType,
    asset.file?.type,
    asset.fileName,
    asset.uri,
  );
  const mediaKind = mediaKindForMimeType(mimeType);
  const fileSize = normalizeFileSize(asset.fileSize);

  enforceFileSize(mediaKind, fileSize);

  return {
    file: asset.file ?? null,
    fileName: asset.fileName ?? null,
    fileSize,
    mediaKind,
    mimeType,
    uri: asset.uri,
  };
}

function normalizeMimeType(
  mimeType: string | null | undefined,
  webFileMimeType: string | null | undefined,
  fileName: string | null | undefined,
  uri: string,
): MediaPostMimeType {
  const normalizedMimeType = mimeType?.trim().toLowerCase();

  if (isMediaPostMimeType(normalizedMimeType)) {
    return normalizedMimeType;
  }

  if (normalizedMimeType) {
    throw new MediaPostSelectionError(UNSUPPORTED_TYPE_ERROR);
  }

  const normalizedWebMimeType = webFileMimeType?.trim().toLowerCase();

  if (isMediaPostMimeType(normalizedWebMimeType)) {
    return normalizedWebMimeType;
  }

  const inferredMimeType =
    inferMimeTypeFromPath(fileName) ?? inferMimeTypeFromPath(uri);

  if (inferredMimeType) {
    return inferredMimeType;
  }

  throw new MediaPostSelectionError(UNSUPPORTED_TYPE_ERROR);
}

function inferMimeTypeFromPath(
  path: string | null | undefined,
): MediaPostMimeType | null {
  const normalizedPath = path?.split(/[?#]/, 1)[0]?.toLowerCase();

  if (normalizedPath?.endsWith('.jpg') || normalizedPath?.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (normalizedPath?.endsWith('.png')) {
    return 'image/png';
  }

  if (normalizedPath?.endsWith('.webp')) {
    return 'image/webp';
  }

  if (normalizedPath?.endsWith('.mp4')) {
    return 'video/mp4';
  }

  return null;
}

function isMediaPostMimeType(
  mimeType: string | undefined,
): mimeType is MediaPostMimeType {
  return MEDIA_POST_MIME_TYPES.some((allowedType) => allowedType === mimeType);
}

function mediaKindForMimeType(mimeType: MediaPostMimeType): MediaPostKind {
  return mimeType === 'video/mp4' ? 'video' : 'image';
}

function normalizeFileSize(fileSize: number | null | undefined): number | null {
  return typeof fileSize === 'number' && Number.isFinite(fileSize) && fileSize >= 0
    ? fileSize
    : null;
}

function enforceFileSize(
  mediaKind: MediaPostKind,
  fileSize: number | null,
): void {
  if (fileSize == null) {
    return;
  }

  if (mediaKind === 'image' && fileSize > IMAGE_MAX_BYTES) {
    throw new MediaPostSelectionError('Images must be 25 MB or smaller.');
  }

  if (mediaKind === 'video' && fileSize > VIDEO_MAX_BYTES) {
    throw new MediaPostSelectionError('Videos must be 100 MB or smaller.');
  }
}
