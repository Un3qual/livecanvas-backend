import { describe, expect, test } from 'vitest';

import {
  MediaPostSelectionError,
  pickPostMediaWithPicker,
  type MediaPostPicker,
} from '../../src/content/mediaPostSelectionCore';

function pickerWithResult(
  result: Awaited<ReturnType<MediaPostPicker['launchImageLibraryAsync']>>,
  granted = true,
): MediaPostPicker {
  return {
    launchImageLibraryAsync: () => Promise.resolve(result),
    requestMediaLibraryPermissionsAsync: () => Promise.resolve({ granted }),
  } as MediaPostPicker;
}

describe('pickPostMedia', () => {
  test('normalizes picker cancellation to null without requesting camera access', async () => {
    let pickerOptions: unknown;
    const picker: MediaPostPicker = {
      launchImageLibraryAsync: (options) => {
        pickerOptions = options;
        return Promise.resolve({ assets: null, canceled: true });
      },
      requestMediaLibraryPermissionsAsync: () =>
        Promise.resolve({ granted: true }),
    } as MediaPostPicker;

    await expect(pickPostMediaWithPicker(picker)).resolves.toBeNull();
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

      await expect(pickPostMediaWithPicker(picker)).resolves.toEqual({
        file: null,
        fileName: 'selected-media',
        fileSize: 1024,
        mediaKind,
        mimeType,
        uri: 'file:///selected-media',
      });
    }
  });

  test('retains the browser File handle for a URI-backed web upload', async () => {
    const file = new File(['browser-file'], 'browser.jpg', {
      type: 'image/jpeg',
    });

    const picker = pickerWithResult({
      canceled: false,
      assets: [
        {
          file,
          fileName: file.name,
          fileSize: file.size,
          height: 100,
          mimeType: file.type,
          type: 'image',
          uri: 'blob:https://livecanvas.test/asset',
          width: 100,
        },
      ],
    });

    await expect(pickPostMediaWithPicker(picker)).resolves.toMatchObject({ file });
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
            height: 100,
            mimeType,
            type: mimeType.startsWith('video/') ? 'video' : 'image',
            uri: 'file:///unsupported',
            width: 100,
          },
        ],
      });

      await expect(pickPostMediaWithPicker(picker)).rejects.toEqual(
        new MediaPostSelectionError(
          'Choose a JPEG, PNG, WebP, or MP4 file.',
        ),
      );
    }
  });

  test('infers an exact allowed MIME type when picker metadata is absent', async () => {
    const examples = [
      ['photo.JPEG', 'file:///ignored', 'image/jpeg', 'image'],
      [null, 'content://picker/asset.webp?token=1', 'image/webp', 'image'],
      ['clip.mp4', 'content://picker/no-extension', 'video/mp4', 'video'],
    ] as const;

    for (const [fileName, uri, mimeType, mediaKind] of examples) {
      const picker = pickerWithResult({
        canceled: false,
        assets: [
          {
            fileName,
            fileSize: 1024,
            height: 100,
            type: mediaKind,
            uri,
            width: 100,
          },
        ],
      });

      await expect(pickPostMediaWithPicker(picker)).resolves.toMatchObject({
        mediaKind,
        mimeType,
      });
    }
  });

  test('rejects missing MIME metadata when no exact allowed extension is available', async () => {
    const picker = pickerWithResult({
      canceled: false,
      assets: [
        {
          fileName: 'unknown.bin',
          fileSize: 1024,
          height: 100,
          type: 'image',
          uri: 'content://picker/unknown',
          width: 100,
        },
      ],
    });

    await expect(pickPostMediaWithPicker(picker)).rejects.toEqual(
      new MediaPostSelectionError('Choose a JPEG, PNG, WebP, or MP4 file.'),
    );
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
        expect((await pickPostMediaWithPicker(picker))?.fileSize).toBe(fileSize);
      } else {
        const expectedMessage = mimeType.startsWith('image/')
          ? 'Images must be 25 MB or smaller.'
          : 'Videos must be 100 MB or smaller.';

        await expect(pickPostMediaWithPicker(picker)).rejects.toEqual(
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
          height: 100,
          mimeType: 'image/png',
          type: 'image',
          uri: 'file:///without-size',
          width: 100,
        },
      ],
    });

    await expect(pickPostMediaWithPicker(noSizePicker)).resolves.toMatchObject({
      fileName: null,
      fileSize: null,
      mimeType: 'image/png',
    });

    await expect(
      pickPostMediaWithPicker(
        pickerWithResult({ assets: null, canceled: true }, false),
      ),
    ).rejects.toEqual(
      new MediaPostSelectionError(
        'Allow photo library access to select media.',
      ),
    );

    const failingPicker = {
      launchImageLibraryAsync: () =>
        Promise.reject(new Error('native details')),
      requestMediaLibraryPermissionsAsync: () =>
        Promise.resolve({ granted: true }),
    } as unknown as MediaPostPicker;

    await expect(pickPostMediaWithPicker(failingPicker)).rejects.toEqual(
      new MediaPostSelectionError('We could not open your media library.'),
    );
  });
});
