import { describe, expect, test } from 'bun:test';

import {
  describeDiagnosticsEndpoint,
  formatAuthStatus,
  formatBootSessionState,
  formatProbeStatus,
} from '../../src/diagnostics/releaseDiagnosticsPresentation';

describe('release diagnostics presentation', () => {
  test('formats configured endpoint URLs without redacting hostnames', () => {
    expect(
      describeDiagnosticsEndpoint({
        label: 'API URL',
        url: 'https://preview-api.livecanvas.example/graphql?token=secret-token#secret-fragment',
      }),
    ).toEqual({
      label: 'API URL',
      value: 'https://preview-api.livecanvas.example/graphql',
      badge: 'Configured endpoint',
      warning: null,
    });

    expect(
      describeDiagnosticsEndpoint({
        label: 'API URL',
        url: 'https://preview-api.livecanvas.example/reset/access_token/secret-token',
      }).value,
    ).toBe(
      'https://preview-api.livecanvas.example/reset/access_token/redacted',
    );

    expect(
      describeDiagnosticsEndpoint({
        label: 'Initial href',
        url: '/diagnostics/refresh_token/secret-refresh-token?x=1#fragment',
      }).value,
    ).toBe('/diagnostics/refresh_token/redacted');

    expect(
      describeDiagnosticsEndpoint({
        label: 'Initial URL',
        url: 'livecanvas-mobile://users/log-in/sign-in-token?x=1',
      }).value,
    ).toBe('livecanvas-mobile://users/log-in/redacted');

    expect(
      describeDiagnosticsEndpoint({
        label: 'Initial URL',
        url: 'livecanvas-mobile://users/reset-password/reset-token',
      }).value,
    ).toBe('livecanvas-mobile://users/reset-password/redacted');

    expect(
      describeDiagnosticsEndpoint({
        label: 'Initial href',
        url: '/users/settings/confirm-email/confirm-token#secret-fragment',
      }).value,
    ).toBe('/users/settings/confirm-email/redacted');

    expect(
      describeDiagnosticsEndpoint({
        label: 'Websocket URL',
        url: 'wss://preview-ws.livecanvas.example/socket',
      }).value,
    ).toBe('wss://preview-ws.livecanvas.example/socket');
  });

  test('labels localhost fallback URLs as local defaults with preview warning copy', () => {
    expect(
      describeDiagnosticsEndpoint({
        label: 'API URL',
        url: 'http://localhost:4000',
      }),
    ).toEqual({
      label: 'API URL',
      value: 'http://localhost:4000',
      badge: 'Local default',
      warning:
        'Localhost is the development fallback. Preview builds should normally use target EAS environment values.',
    });
  });

  test('renders boot session and current auth states for operators', () => {
    expect(formatBootSessionState('signed_out')).toBe('Signed out');
    expect(formatBootSessionState('authenticated')).toBe('Authenticated');
    expect(formatBootSessionState('forced_logout')).toBe('Forced logout');

    expect(formatAuthStatus('loading')).toBe('Loading');
    expect(formatAuthStatus('unauthenticated')).toBe('Signed out');
    expect(formatAuthStatus('authenticated')).toBe('Authenticated');
  });

  test('renders probe statuses', () => {
    expect(formatProbeStatus({ status: 'idle' })).toBe('Not run');
    expect(formatProbeStatus({ status: 'checking' })).toBe('Checking...');
    expect(formatProbeStatus({ status: 'reachable' })).toBe('Reachable');
    expect(
      formatProbeStatus({ status: 'failed', reason: 'HTTP 500 transport failure' }),
    ).toBe('Failed: HTTP 500 transport failure');
  });
});
