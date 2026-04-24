import { describe, expect, mock, test } from 'bun:test';

mock.module('react-native', () => ({
  Linking: {
    getInitialURL: async () => null,
  },
  Platform: {
    OS: 'ios',
  },
}));

const { resolveLandingHrefForAuth, routeHrefFromUrl } = await import('./runtime');
mock.restore();

describe('routeHrefFromUrl', () => {
  test('accepts the sign-up deep link route', () => {
    expect(routeHrefFromUrl('livecanvas-mobile://sign-up')).toBe('/sign-up');
  });
});

describe('resolveLandingHrefForAuth', () => {
  test('sends unauthenticated cold starts to sign-in when the deep link is protected', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl: 'livecanvas-mobile://profile',
          initialHref: '/profile',
          landingHref: '/profile',
          defaultHref: '/sign-in',
          bootSessionState: 'signed_out',
          resetReason: null,
        },
        'unauthenticated',
      ),
    ).toBe('/sign-in');
  });

  test('preserves auth route deep links for unauthenticated sessions', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl: 'livecanvas-mobile://sign-up',
          initialHref: '/sign-up',
          landingHref: '/sign-up',
          defaultHref: '/sign-in',
          bootSessionState: 'signed_out',
          resetReason: null,
        },
        'unauthenticated',
      ),
    ).toBe('/sign-up');
  });

  test('sends authenticated auth-route cold starts to home', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl: 'livecanvas-mobile://sign-in',
          initialHref: '/sign-in',
          landingHref: '/sign-in',
          defaultHref: '/sign-in',
          bootSessionState: 'signed_out',
          resetReason: null,
        },
        'authenticated',
      ),
    ).toBe('/home');
  });
});
