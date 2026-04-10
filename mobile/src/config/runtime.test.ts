import { describe, expect, mock, test } from 'bun:test';

mock.module('react-native', () => ({
  Linking: {
    getInitialURL: async () => null,
  },
}));

const { routeHrefFromUrl } = await import('./runtime');

describe('routeHrefFromUrl', () => {
  test('accepts the sign-up deep link route', () => {
    expect(routeHrefFromUrl('livecanvas-mobile://sign-up')).toBe('/sign-up');
  });
});
