import { describe, expect, test } from 'bun:test';

import {
  countConnectionEdges,
  formatPrivacyModeLabel,
  formatProfileIdentity,
} from './profilePresentation';

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
});
