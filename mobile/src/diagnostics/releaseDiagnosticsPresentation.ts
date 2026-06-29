import type { AuthState } from '../auth/types';
import type { BootSessionState } from '../config/environment';

const LOCALHOST_PREVIEW_WARNING =
  'Localhost is the development fallback. Preview builds should normally use target EAS environment values.';

type DiagnosticsEndpointInput = {
  label: string;
  url: string;
};

export type DiagnosticsEndpointPresentation = {
  label: string;
  value: string;
  badge: 'Configured endpoint' | 'Local default';
  warning: string | null;
};

export type DiagnosticsProbeStatus =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'reachable' }
  | { status: 'failed'; reason: string };

export function describeDiagnosticsEndpoint({
  label,
  url,
}: DiagnosticsEndpointInput): DiagnosticsEndpointPresentation {
  const isLocalDefault = isLocalhostUrl(url);

  return {
    label,
    value: formatTokenSafeDiagnosticUrl(url),
    badge: isLocalDefault ? 'Local default' : 'Configured endpoint',
    warning: isLocalDefault ? LOCALHOST_PREVIEW_WARNING : null,
  };
}

export function formatBootSessionState(state: BootSessionState): string {
  switch (state) {
    case 'authenticated':
      return 'Authenticated';
    case 'forced_logout':
      return 'Forced logout';
    case 'signed_out':
      return 'Signed out';
  }
}

export function formatAuthStatus(status: AuthState['status']): string {
  switch (status) {
    case 'authenticated':
      return 'Authenticated';
    case 'loading':
      return 'Loading';
    case 'unauthenticated':
      return 'Signed out';
  }
}

export function formatProbeStatus(status: DiagnosticsProbeStatus): string {
  switch (status.status) {
    case 'checking':
      return 'Checking...';
    case 'failed':
      return `Failed: ${status.reason}`;
    case 'idle':
      return 'Not run';
    case 'reachable':
      return 'Reachable';
  }
}

export function formatTokenSafeDiagnosticUrl(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return trimmed;
  }

  try {
    return sanitizeParsedUrl(new URL(trimmed), trimmed);
  } catch {
    if (trimmed.startsWith('/')) {
      try {
        const parsed = new URL(trimmed, 'https://diagnostics.local');
        parsed.search = '';
        parsed.hash = '';
        return parsed.pathname;
      } catch {
        return stripUnsafeSuffix(trimmed);
      }
    }

    return stripUnsafeSuffix(trimmed);
  }
}

function isLocalhostUrl(rawUrl: string): boolean {
  try {
    const { hostname } = new URL(rawUrl);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

function sanitizeParsedUrl(url: URL, originalValue: string): string {
  const shouldSanitize =
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0;

  if (!shouldSanitize) {
    return originalValue;
  }

  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';

  return url.toString();
}

function stripUnsafeSuffix(value: string): string {
  const queryIndex = value.indexOf('?');
  const fragmentIndex = value.indexOf('#');
  const suffixIndexes = [queryIndex, fragmentIndex].filter((index) => index >= 0);

  return suffixIndexes.length > 0
    ? value.slice(0, Math.min(...suffixIndexes))
    : value;
}
