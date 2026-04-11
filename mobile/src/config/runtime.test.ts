import { describe, expect, mock, test } from 'bun:test';

mock.module('react-native', () => ({
  Linking: {
    getInitialURL: async () => null,
  },
  Platform: {
    OS: 'ios',
  },
}));

const { routeHrefFromUrl } = await import('./runtime');
mock.restore();

describe('routeHrefFromUrl', () => {
  test('accepts the sign-up deep link route', () => {
    expect(routeHrefFromUrl('livecanvas-mobile://sign-up')).toBe('/sign-up');
  });
});
