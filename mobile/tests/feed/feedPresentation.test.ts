import { describe, expect, test } from 'bun:test';

import {
  formatFeedMediaAssetPresentation,
  formatPostAuthorPresentation,
  formatPostCardPresentation,
  formatPostVisibilityLabel,
  formatStoryExpiryLabel,
} from '../../src/feed/feedPresentation';

describe('feedPresentation', () => {
  test('formats standard and story posts with opaque Relay IDs preserved', () => {
    expect(
      formatPostCardPresentation({
        id: 'UG9zdDox',
        kind: 'STANDARD',
        bodyText: '  First public post  ',
        visibility: 'PUBLIC',
        expiresAt: null,
        insertedAt: '2026-06-30T17:15:30Z',
        author: {
          id: 'VXNlcjox',
          email: 'creator@example.com',
        },
        mediaAssets: [],
      }),
    ).toEqual({
      id: 'UG9zdDox',
      kindLabel: 'Post',
      body: 'First public post',
      visibilityLabel: 'Public',
      timestampLabel: 'Jun 30, 2026',
      storyExpiryLabel: null,
      author: {
        title: 'creator@example.com',
        subtitle: 'Creator',
        initials: 'C',
      },
      mediaAssets: [],
    });

    expect(
      formatPostCardPresentation({
        id: 'UG9zdDoy',
        kind: 'STORY',
        bodyText: 'Story update',
        visibility: 'FOLLOWERS',
        expiresAt: '2026-07-01T17:15:30Z',
        insertedAt: '2026-06-30T17:15:30Z',
        author: {
          id: 'VXNlcjoy',
          email: null,
        },
        mediaAssets: [],
      }),
    ).toEqual({
      id: 'UG9zdDoy',
      kindLabel: 'Story',
      body: 'Story update',
      visibilityLabel: 'Followers',
      timestampLabel: 'Jun 30, 2026',
      storyExpiryLabel: 'Expires Jul 1, 2026',
      author: {
        title: 'LiveCanvas creator',
        subtitle: 'Profile ID VXNlcjoy',
        initials: 'LC',
      },
      mediaAssets: [],
    });
  });

  test('uses neutral fallback copy for empty or unknown post body and kind values', () => {
    expect(
      formatPostCardPresentation({
        id: 'UG9zdDoz',
        kind: '%future added value',
        bodyText: '   ',
        visibility: '%future added value',
        expiresAt: 'not-a-date',
        insertedAt: 'not-a-date',
        author: {
          id: 'VXNlcjoz',
          email: '  ',
        },
        mediaAssets: [],
      }),
    ).toEqual({
      id: 'UG9zdDoz',
      kindLabel: 'Post',
      body: 'No caption provided.',
      visibilityLabel: 'Visibility unavailable',
      timestampLabel: 'Date unavailable',
      storyExpiryLabel: 'Expiry unavailable',
      author: {
        title: 'LiveCanvas creator',
        subtitle: 'Profile ID VXNlcjoz',
        initials: 'LC',
      },
      mediaAssets: [],
    });
  });

  test('formats media asset processing states without exposing unusable URLs', () => {
    expect(
      formatFeedMediaAssetPresentation({
        id: 'TWVkaWFBc3NldDox',
        mimeType: 'image/jpeg',
        processingState: 'PROCESSED',
        publicUrl: '  https://media.example.test/post.jpg  ',
      }),
    ).toEqual({
      id: 'TWVkaWFBc3NldDox',
      label: 'Image',
      state: 'available',
      publicUrl: 'https://media.example.test/post.jpg',
      body: 'Media is ready.',
    });

    expect(
      formatFeedMediaAssetPresentation({
        id: 'TWVkaWFBc3NldDoy',
        mimeType: 'video/mp4',
        processingState: 'UPLOADED',
        publicUrl: 'https://media.example.test/ignored.mp4',
      }),
    ).toEqual({
      id: 'TWVkaWFBc3NldDoy',
      label: 'Video',
      state: 'processing',
      publicUrl: null,
      body: 'Media is still processing.',
    });

    expect(
      formatFeedMediaAssetPresentation({
        id: 'TWVkaWFBc3NldDoz',
        mimeType: 'application/octet-stream',
        processingState: 'FAILED',
        publicUrl: 'https://media.example.test/ignored.bin',
      }),
    ).toEqual({
      id: 'TWVkaWFBc3NldDoz',
      label: 'Media',
      state: 'failed',
      publicUrl: null,
      body: 'Media could not be processed.',
    });

    expect(
      formatFeedMediaAssetPresentation({
        id: 'TWVkaWFBc3NldDo0',
        mimeType: null,
        processingState: '%future added value',
        publicUrl: 'not a url',
      }),
    ).toEqual({
      id: 'TWVkaWFBc3NldDo0',
      label: 'Media',
      state: 'unavailable',
      publicUrl: null,
      body: 'Media is unavailable.',
    });
  });

  test('formats author, visibility, and story expiry labels independently', () => {
    expect(
      formatPostAuthorPresentation({
        id: 'VXNlcjo0',
        email: '  author@example.com  ',
      }),
    ).toEqual({
      title: 'author@example.com',
      subtitle: 'Creator',
      initials: 'A',
    });

    expect(formatPostVisibilityLabel('PUBLIC')).toBe('Public');
    expect(formatPostVisibilityLabel('FOLLOWERS')).toBe('Followers');
    expect(formatPostVisibilityLabel('%future added value')).toBe(
      'Visibility unavailable',
    );

    expect(formatStoryExpiryLabel('2026-07-01T00:00:00Z')).toBe(
      'Expires Jul 1, 2026',
    );
    expect(formatStoryExpiryLabel(null)).toBe(null);
    expect(formatStoryExpiryLabel('bad-date')).toBe('Expiry unavailable');
  });
});
