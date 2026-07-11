import { describe, expect, test } from 'bun:test';

import {
  MediaPostSelectionError,
  pickPostMedia,
  type MediaPostPicker,
} from '../../src/content/mediaPostSelection';

function pickerWithResult(
  result: Awaited<ReturnType<MediaPostPicker['launchImageLibraryAsync']>>,
  granted = true,
): MediaPostPicker {
  return {
    launchImageLibraryAsync: async () => result,
    requestMediaLibraryPermissionsAsync: async () => ({ granted }),
  } as MediaPostPicker;
}

describe('pickPostMedia', () => {
  test('normalizes picker cancellation to null without requesting camera access', async () => {
    let pickerOptions: unknown;
    const picker: MediaPostPicker = {
      launchImageLibraryAsync: async (options) => {
        pickerOptions = options;
        return { assets: null, canceled: true };
      },
      requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
    } as MediaPostPicker;

    await expect(pickPostMedia(picker)).resolves.toBeNull();
    expect(pickerOptions).toEqual({
      allowsEditing: false,
      allowsMultipleSelection: false,
      mediaTypes: ['images', 'videos'],
      quality: 1,
    });
    expect('requestCameraPermissionsAsync' in picker).toBe(false);
  });

  test('returns normalized image and video selections for the exact allowlist', async () => {
    const examples = [
      ['image/jpeg', 'image'],
      ['image/png', 'image'],
      ['image/webp', 'image'],
      ['video/mp4', 'video'],
    ] as const;

    for (const [mimeType, mediaKind] of examples) {
      const picker = pickerWithResult({
        canceled: false,
        assets: [
          {
            assetId: null,
            base64: null,
            duration: null,
            exif: null,
            fileName: 'selected-media',
            fileSize: 1024,
            height: 100,
            mimeType,
            pairedVideoAsset: null,
            type: mediaKind,
            uri: 'file:///selected-media',
            width: 100,
          },
        ],
      });

      await expect(pickPostMedia(picker)).resolves.toEqual({
        fileName: 'selected-media',
        fileSize: 1024,
        mediaKind,
        mimeType,
        uri: 'file:///selected-media',
      });
    }
  });

  test('rejects unsupported media with viewer-safe copy', async () => {
    for (const mimeType of [
      'image/gif',
      'image/heic',
      'video/quicktime',
      'image/*',
      'application/octet-stream',
    ]) {
      const picker = pickerWithResult({
        canceled: false,
        assets: [
          {
            fileName: null,
            fileSize: undefined,
            height: 100,
            mimeType,
            type: mimeType.startsWith('video/') ? 'video' : 'image',
            uri: 'file:///unsupported',
            width: 100,
          },
        ],
      });

      await expect(pickPostMedia(picker)).rejects.toEqual(
        new MediaPostSelectionError(
          'Choose a JPEG, PNG, WebP, or MP4 file.',
        ),
      );
    }
  });

  test('enforces image and video limits when picker size metadata is available', async () => {
    const cases = [
      ['image/jpeg', 25 * 1024 * 1024, true],
      ['image/jpeg', 25 * 1024 * 1024 + 1, false],
      ['video/mp4', 100 * 1024 * 1024, true],
      ['video/mp4', 100 * 1024 * 1024 + 1, false],
    ] as const;

    for (const [mimeType, fileSize, accepted] of cases) {
      const picker = pickerWithResult({
        canceled: false,
        assets: [
          {
            fileName: 'boundary',
            fileSize,
            height: 100,
            mimeType,
            type: mimeType === 'video/mp4' ? 'video' : 'image',
            uri: 'file:///boundary',
            width: 100,
          },
        ],
      });

      if (accepted) {
        expect((await pickPostMedia(picker))?.fileSize).toBe(fileSize);
      } else {
        const expectedMessage = mimeType.startsWith('image/')
          ? 'Images must be 25 MB or smaller.'
          : 'Videos must be 100 MB or smaller.';

        await expect(pickPostMedia(picker)).rejects.toEqual(
          new MediaPostSelectionError(expectedMessage),
        );
      }
    }
  });

  test('accepts absent size metadata and maps permission or picker failures safely', async () => {
    const noSizePicker = pickerWithResult({
      canceled: false,
      assets: [
        {
          fileName: null,
          fileSize: undefined,
          height: 100,
          mimeType: 'image/png',
          type: 'image',
          uri: 'file:///without-size',
          width: 100,
        },
      ],
    });

    await expect(pickPostMedia(noSizePicker)).resolves.toMatchObject({
      fileName: null,
      fileSize: null,
      mimeType: 'image/png',
    });

    await expect(
      pickPostMedia(pickerWithResult({ assets: null, canceled: true }, false)),
    ).rejects.toEqual(
      new MediaPostSelectionError(
        'Allow photo library access to select media.',
      ),
    );

    const failingPicker = {
      launchImageLibraryAsync: async () => {
        throw new Error('native details');
      },
      requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
    } as unknown as MediaPostPicker;

    await expect(pickPostMedia(failingPicker)).rejects.toEqual(
      new MediaPostSelectionError('We could not open your media library.'),
    );
  });
});
