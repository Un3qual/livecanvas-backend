export type BootSessionState = 'signed_out' | 'authenticated' | 'forced_logout';

export type AppEnvironment = {
  apiBaseUrl: string;
  websocketUrl: string;
  bootSessionState: BootSessionState;
};

type EnvironmentInput = Record<string, string | undefined>;

const DEFAULT_API_BASE_URL = 'http://localhost:4000';
const DEFAULT_WEBSOCKET_URL = 'ws://localhost:4000/socket';

function readProcessEnvironment(): EnvironmentInput {
  const maybeProcess = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };

  return maybeProcess.process?.env ?? {};
}

function normalizeUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();

  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function normalizeBootSessionState(value: string | undefined): BootSessionState {
  switch (value) {
    case 'authenticated':
    case 'forced_logout':
      return value;
    default:
      return 'signed_out';
  }
}

export function resolveEnvironment(
  input: EnvironmentInput = readProcessEnvironment(),
): AppEnvironment {
  return {
    apiBaseUrl: normalizeUrl(input.EXPO_PUBLIC_API_BASE_URL, DEFAULT_API_BASE_URL),
    websocketUrl: normalizeUrl(
      input.EXPO_PUBLIC_WEBSOCKET_URL,
      DEFAULT_WEBSOCKET_URL,
    ),
    bootSessionState: normalizeBootSessionState(
      input.EXPO_PUBLIC_BOOT_SESSION_STATE,
    ),
  };
}
