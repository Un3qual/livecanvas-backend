import type { AuthState } from '../auth/types';
import type { BootSessionState } from '../config/environment';

const LOCALHOST_PREVIEW_WARNING =
  'Localhost is the development fallback. Preview builds should normally use target EAS environment values.';
const TOKEN_PATH_SEGMENT_REDACTION = 'redacted';

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
    default:
      return formatUnexpectedValue(state);
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
    default:
      return formatUnexpectedValue(status);
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
    default:
      return formatUnexpectedValue(status);
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
        // The synthetic origin exists only for URL parsing; only the safe path is returned.
        const parsed = new URL(trimmed, 'https://diagnostics.local');
        parsed.search = '';
        parsed.hash = '';
        return redactTokenPathSegments(parsed.pathname);
      } catch {
        return redactTokenPathSegments(stripUnsafeSuffix(trimmed));
      }
    }

    return redactTokenPathSegments(stripUnsafeSuffix(trimmed));
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
  const safePathname = redactTokenPathSegments(url.pathname);
  const shouldSanitize =
    url.username.length > 0 ||
    url.password.length > 0 ||
    safePathname !== url.pathname ||
    url.search.length > 0 ||
    url.hash.length > 0;

  if (!shouldSanitize) {
    return originalValue;
  }

  url.username = '';
  url.password = '';
  url.pathname = safePathname;
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

function redactTokenPathSegments(pathname: string): string {
  const segments = pathname.split('/');

  return segments
    .map((segment, index) => {
      const previousSegment = segments[index - 1];

      if (
        previousSegment &&
        isTokenPathSegmentKey(safeDecodeURIComponent(previousSegment))
      ) {
        return TOKEN_PATH_SEGMENT_REDACTION;
      }

      const decodedSegment = safeDecodeURIComponent(segment);
      const [segmentKey, ...segmentValue] = decodedSegment.split('=');

      if (segmentValue.length > 0 && isTokenPathSegmentKey(segmentKey)) {
        return `${segmentKey}=${TOKEN_PATH_SEGMENT_REDACTION}`;
      }

      return segment;
    })
    .join('/');
}

function isTokenPathSegmentKey(segment: string): boolean {
  const normalized = segment.toLowerCase().replace(/[^a-z]/g, '');
  return (
    normalized === 'confirmemail' ||
    normalized === 'login' ||
    normalized === 'resetpassword' ||
    normalized === 'token' ||
    normalized.endsWith('token')
  );
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function formatUnexpectedValue(value: never): string {
  return String(value);
}
