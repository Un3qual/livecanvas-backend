import { afterEach, describe, expect, test } from 'vitest';
import { transformFileSync } from '@babel/core';

const originalOrigin = process.env.EXPO_PUBLIC_APP_ORIGIN;

afterEach(() => {
  if (originalOrigin === undefined) {
    delete process.env.EXPO_PUBLIC_APP_ORIGIN;
  } else {
    process.env.EXPO_PUBLIC_APP_ORIGIN = originalOrigin;
  }
});

describe('Expo public environment bundling', () => {
  test('rewrites the configured app origin through Expo virtual env', () => {
    process.env.EXPO_PUBLIC_APP_ORIGIN = 'https://app.production.example';

    const output = transformFileSync('src/config/environment.ts', {
      configFile: './babel.config.js',
      envName: 'production',
    })?.code;

    expect(output).toContain('expo/virtual/env');
    expect(output).toContain('env.EXPO_PUBLIC_APP_ORIGIN');
    expect(output).not.toContain('globalThis.process');
  });
});
