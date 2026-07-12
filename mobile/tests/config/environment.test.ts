import { describe, expect, test } from 'bun:test';

import { resolveEnvironment } from '../../src/config/environment';

describe('public app origin environment', () => {
  test('uses the valid explicit-port localhost origin by default', () => {
    expect(resolveEnvironment({}).publicAppOrigin).toBe(
      'https://localhost:4000',
    );
  });

  test('normalizes the configured HTTPS origin independently from the API origin', () => {
    const environment = resolveEnvironment({
      EXPO_PUBLIC_API_BASE_URL: 'https://api.livecanvas.example',
      EXPO_PUBLIC_APP_ORIGIN: '  https://app.livecanvas.example/  ',
    });

    expect(environment.publicAppOrigin).toBe(
      'https://app.livecanvas.example',
    );
    expect(environment.publicAppOrigin).not.toBe(environment.apiBaseUrl);
  });

  test('rejects malformed and placeholder public app origins', () => {
    for (const publicAppOrigin of [
      'http://app.livecanvas.example',
      'https://',
      'https://livecanvas.invalid',
      'https://placeholder.invalid/',
      'https://user@app.livecanvas.example',
      'https://app.livecanvas.example/invites',
      'https://app.livecanvas.example?token=visible',
      'https://app.livecanvas.example#token=visible',
    ]) {
      expect(() =>
        resolveEnvironment({
          EXPO_PUBLIC_APP_ORIGIN: publicAppOrigin,
        }),
      ).toThrow(/EXPO_PUBLIC_APP_ORIGIN.*absolute HTTPS origin/);
    }
  });
});
