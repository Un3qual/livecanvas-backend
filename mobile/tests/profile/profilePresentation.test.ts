import { describe, expect, test } from 'vitest';

import {
  countConnectionEdges,
  formatConnectionPreviewCount,
  formatFollowRequestPreview,
  formatPrivacyModeLabel,
  formatProfileIdentity,
} from '../../src/profile/profilePresentation';

describe('profilePresentation', () => {
  test('uses viewer email as the stable profile identity when available', () => {
    expect(
      formatProfileIdentity({
        id: 'VXNlcjoxMjM=',
        email: 'viewer@example.com',
      }),
    ).toEqual({
      title: 'viewer@example.com',
      subtitle: 'Signed in with email',
      initials: 'V',
    });
  });

  test('keeps email initials independent from device locale transforms', () => {
    expect(
      formatProfileIdentity({
        id: 'VXNlcjoxMjM=',
        email: 'i@example.com',
      }).initials,
    ).toBe('I');
  });

  test('falls back to an opaque profile label when email is unavailable', () => {
    expect(
      formatProfileIdentity({
        id: 'VXNlcjoxMjM0NTY3ODkw',
        email: null,
      }),
    ).toEqual({
      title: 'LiveCanvas user',
      subtitle: 'Profile ID VXNlcjox',
      initials: 'LC',
    });
  });

  test('formats known privacy modes and keeps unknown modes explicit', () => {
    expect(formatPrivacyModeLabel('PUBLIC')).toEqual({
      label: 'Public profile',
      description: 'People can discover your profile and request to follow you.',
    });
    expect(formatPrivacyModeLabel('PRIVATE')).toEqual({
      label: 'Private profile',
      description: 'New followers need approval before they can see protected activity.',
    });
    expect(formatPrivacyModeLabel('%future added value')).toEqual({
      label: 'Privacy mode unavailable',
      description: 'Refresh later to see the current profile privacy setting.',
    });
  });

  test('counts only visible connection edge nodes', () => {
    expect(
      countConnectionEdges({
        edges: [
          { node: { id: 'user-1' } },
          null,
          { node: null },
          { node: { id: 'user-2' } },
        ],
      }),
    ).toBe(2);

    expect(countConnectionEdges(null)).toBe(0);
  });

  test('formats preview connection counts without implying full totals', () => {
    expect(
      formatConnectionPreviewCount({
        hasNextPage: false,
        visibleCount: 2,
      }),
    ).toBe('2');

    expect(
      formatConnectionPreviewCount({
        hasNextPage: true,
        visibleCount: 10,
      }),
    ).toBe('10+');
  });

  test('formats follow request state and requested date for display', () => {
    expect(
      formatFollowRequestPreview({
        state: 'REQUESTED',
        requestedAt: '2026-04-25T17:44:38Z',
      }),
    ).toEqual({
      stateLabel: 'Requested',
      requestedAtLabel: 'Apr 25, 2026',
    });

    expect(
      formatFollowRequestPreview({
        state: '%future added value',
        requestedAt: 'not-a-date',
      }),
    ).toEqual({
      stateLabel: 'Pending',
      requestedAtLabel: 'Date unavailable',
    });
  });
});
