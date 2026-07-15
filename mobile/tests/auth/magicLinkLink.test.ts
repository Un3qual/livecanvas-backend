import { describe, expect, test } from 'vitest';

import {
  parseMagicLink,
  redactMagicLinkSnapshotUrl,
} from '../../src/auth/magicLink/magicLinkLink';

const publicOrigin = 'https://app.example.test:4443';

describe('parseMagicLink', () => {
  test.each([
    [
      'livecanvas-mobile://magic-link/sign-in?token=login%2Esecret',
      { status: 'valid', purpose: 'signIn', token: 'login.secret' },
    ],
    [
      'livecanvas-mobile://magic-link/sign-up?token=signup%2Esecret',
      { status: 'valid', purpose: 'signUp', token: 'signup.secret' },
    ],
    [
      'https://app.example.test:4443/auth/magic-link/sign-in#token=https%2Esecret',
      { status: 'valid', purpose: 'signIn', token: 'https.secret' },
    ],
  ] as const)('accepts an exact supported link', (path, expected) => {
    expect(parseMagicLink(path, publicOrigin)).toEqual(expected);
  });

  test.each([
    'livecanvas-mobile://magic-link/sign-in?token=one&token=two',
    'livecanvas-mobile://magic-link/sign-in?token=one&source=email',
    'livecanvas-mobile://magic-link/sign-in?token=one=two',
    'livecanvas-mobile://magic-link/sign-in?token=%20%20',
    'livecanvas-mobile://magic-link/sign-in?token=bad%ZZvalue',
    'livecanvas-mobile://user@magic-link/sign-in?token=secret',
    'livecanvas-mobile://magic-link:444/sign-in?token=secret',
    'livecanvas-mobile://magic-link/sign-in/?token=secret',
    'livecanvas-mobile://magic-link/%73ign-in?token=secret',
    'livecanvas-mobile://%6Dagic-link/sign-in?token=secret',
    'https://wrong.example.test:4443/auth/magic-link/sign-in#token=secret',
    'https://app.example.test:4444/auth/magic-link/sign-in#token=secret',
    'https://user@app.example.test:4443/auth/magic-link/sign-in#token=secret',
    'https://app.example.test:4443/auth/magic-link/sign-in?token=secret',
    'https://app.example.test:4443/auth/magic-link/sign-in/#token=secret',
    'https://app.example.test:4443/auth/magic-link/%73ign-in#token=secret',
  ])('fails closed for a recognizable malformed link: %s', (path) => {
    expect(parseMagicLink(path, publicOrigin)).toEqual({ status: 'invalid' });
  });

  test('leaves unrelated routes untouched', () => {
    expect(parseMagicLink('livecanvas-mobile://profile', publicOrigin)).toEqual({
      status: 'not_magic_link',
    });
  });
});

describe('redactMagicLinkSnapshotUrl', () => {
  test('removes valid and malformed raw credentials from startup snapshots', () => {
    for (const initialUrl of [
      'livecanvas-mobile://magic-link/sign-in?token=raw-secret',
      'https://app.example.test:4443/auth/magic-link/sign-up#token=raw-secret',
      'livecanvas-mobile://magic-link/sign-in?token=one&token=two',
    ]) {
      expect(redactMagicLinkSnapshotUrl(initialUrl, publicOrigin)).toBe(
        '/magic-link',
      );
    }
  });
});
