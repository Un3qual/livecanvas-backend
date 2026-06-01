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

  test('preserves live-session query params in known protected deep links', () => {
    expect(
      routeHrefFromUrl(
        'livecanvas-mobile://live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
      ),
    ).toBe('/live-session?sessionId=TGl2ZVNlc3Npb246MTIz');
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

  test('sends forced logout snapshots to sign-in after authenticated auth settles', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl: 'livecanvas-mobile://profile',
          initialHref: '/profile',
          landingHref: '/sign-in',
          defaultHref: '/home',
          bootSessionState: 'forced_logout',
          resetReason: 'forced_logout',
        },
        'authenticated',
      ),
    ).toBe('/sign-in');
  });

  test('keeps forced logout snapshots loading until auth settles', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl: 'livecanvas-mobile://profile',
          initialHref: '/profile',
          landingHref: '/sign-in',
          defaultHref: '/home',
          bootSessionState: 'forced_logout',
          resetReason: 'forced_logout',
        },
        'loading',
      ),
    ).toBeNull();
  });

  test('sends unauthenticated live-session deep links to sign-in', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl:
            'livecanvas-mobile://live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
          initialHref: '/live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
          landingHref: '/live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
          defaultHref: '/sign-in',
          bootSessionState: 'signed_out',
          resetReason: null,
        },
        'unauthenticated',
      ),
    ).toBe('/sign-in');
  });

  test('preserves authenticated live-session deep links after auth settles', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl:
            'livecanvas-mobile://live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
          initialHref: '/live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
          landingHref: '/live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
          defaultHref: '/home',
          bootSessionState: 'authenticated',
          resetReason: null,
        },
        'authenticated',
      ),
    ).toBe('/live-session?sessionId=TGl2ZVNlc3Npb246MTIz');
  });
});
