import { Linking } from 'react-native';

import type { AppEnvironment, BootSessionState } from './environment';
import { redactContactInviteSnapshotUrl } from '../contacts/contactInviteLink';

const KNOWN_ROUTE_HREFS = new Set([
  '/sign-in',
  '/sign-up',
  '/password-recovery',
  '/reset-password',
  '/home',
  '/profile',
  '/settings',
  '/compose',
  '/contacts',
  '/diagnostics',
  '/live-session',
  '/host-broadcast',
  '/invite',
]);

const AUTH_ROUTE_HREFS = new Set([
  '/sign-in',
  '/sign-up',
  '/password-recovery',
  '/reset-password',
]);
const AUTH_RETURN_TO_ROUTE_HREFS = new Set([
  '/compose',
  '/contacts',
  '/diagnostics',
  '/live-session',
  '/settings',
  '/host-broadcast',
  '/invite',
]);

type ResolvedAuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type StartupSnapshot = {
  initialUrl: string | null;
  initialHref: string | null;
  landingHref: string;
  defaultHref: string;
  bootSessionState: BootSessionState;
  resetReason: 'forced_logout' | null;
};

type BootstrapOptions = {
  getInitialUrl?: () => Promise<string | null>;
};

export async function bootstrapRuntime(
  environment: AppEnvironment,
  options: BootstrapOptions = {},
): Promise<StartupSnapshot> {
  const getInitialUrl = options.getInitialUrl ?? Linking.getInitialURL;
  let initialUrl: string | null;

  try {
    initialUrl = await getInitialUrl();
  } catch {
    initialUrl = null;
  }

  return deriveStartupSnapshot(
    environment,
    redactContactInviteSnapshotUrl(initialUrl, environment.publicAppOrigin),
  );
}

function deriveStartupSnapshot(
  environment: AppEnvironment,
  initialUrl: string | null,
): StartupSnapshot {
  const initialHref = routeHrefFromUrl(initialUrl);
  const defaultHref =
    environment.bootSessionState === 'authenticated' ? '/home' : '/sign-in';
  const landingHref =
    environment.bootSessionState === 'forced_logout'
      ? '/sign-in'
      : initialHref ?? defaultHref;

  return {
    initialUrl,
    initialHref,
    landingHref,
    defaultHref,
    bootSessionState: environment.bootSessionState,
    resetReason:
      environment.bootSessionState === 'forced_logout'
        ? 'forced_logout'
        : null,
  };
}

export function settleForcedLogoutSnapshot(
  snapshot: StartupSnapshot,
): StartupSnapshot {
  return {
    ...snapshot,
    landingHref: '/sign-in',
    defaultHref: '/sign-in',
    bootSessionState: 'signed_out',
  };
}

export function resolveLandingHrefForAuth(
  snapshot: StartupSnapshot,
  authStatus: ResolvedAuthStatus,
): string | null {
  const initialHref = snapshot.initialHref;
  const initialRoutePath = initialHref ? routePathFromHref(initialHref) : null;

  if (authStatus === 'loading') {
    return null;
  }

  if (snapshot.bootSessionState === 'forced_logout') {
    return '/sign-in';
  }

  if (authStatus === 'unauthenticated') {
    if (initialRoutePath === '/invite') {
      return initialHref;
    }

    if (
      initialHref &&
      initialRoutePath &&
      AUTH_ROUTE_HREFS.has(initialRoutePath)
    ) {
      return initialHref;
    }

    return authRouteHref('/sign-in', initialHref);
  }

  return initialHref && initialRoutePath && !AUTH_ROUTE_HREFS.has(initialRoutePath)
    ? initialHref
    : '/home';
}

function routePathFromHref(href: string): string {
  return href.split('?', 1)[0] ?? href;
}

export function authRouteHref(
  routeHref: '/sign-in' | '/sign-up',
  returnToHref?: string | null,
): string {
  const returnTo = normalizeAuthReturnToHref(returnToHref);

  return returnTo
    ? `${routeHref}?returnTo=${encodeURIComponent(returnTo)}`
    : routeHref;
}

export function readAuthReturnToParam(
  rawReturnTo: string | string[] | undefined,
): string | null {
  if (Array.isArray(rawReturnTo)) {
    return null;
  }

  return normalizeAuthReturnToHref(rawReturnTo);
}

function normalizeAuthReturnToHref(returnToHref?: string | null): string | null {
  const trimmed = returnToHref?.trim();

  if (!trimmed) {
    return null;
  }

  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('#') ||
    !hasValidPercentEncoding(trimmed)
  ) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed, 'https://mobile.livecanvas.invalid');
  } catch {
    return null;
  }

  const routePath = parsed.pathname;

  if (!AUTH_RETURN_TO_ROUTE_HREFS.has(routePath)) {
    return null;
  }

  if (routePath === '/invite') {
    const handoffs = parsed.searchParams.getAll('handoff');
    const handoff = handoffs[0];

    return parsed.searchParams.size === 1 && isOpaqueHandoffId(handoff)
      ? `/invite?handoff=${encodeURIComponent(handoff)}`
      : null;
  }

  if (routePath === '/live-session') {
    const sessionIds = parsed.searchParams.getAll('sessionId');
    const sessionId = sessionIds[0];

    return parsed.searchParams.size === 1 && Boolean(sessionId?.trim())
      ? `/live-session?sessionId=${encodeURIComponent(sessionId ?? '')}`
      : null;
  }

  return parsed.search ? null : routePath;
}

export function routeHrefFromUrl(initialUrl: string | null): string | null {
  if (!initialUrl) {
    return null;
  }

  const withoutFragment = initialUrl.split('#', 1)[0] ?? '';
  const queryStart = withoutFragment.indexOf('?');
  const routeHref =
    queryStart === -1 ? withoutFragment : withoutFragment.slice(0, queryStart);
  const query = queryStart === -1 ? '' : withoutFragment.slice(queryStart + 1);
  const [, routeSource = routeHref] = routeHref.split('://', 2);

  // Expo deep links commonly encode the first route segment as the URL host.
  const candidate = `/${routeSource.replace(/^\/+/, '').replace(/\/+$/, '')}`;

  if (!candidate || candidate === '/') {
    return null;
  }

  if (!KNOWN_ROUTE_HREFS.has(candidate)) {
    return (
      resetPasswordHrefFromBackendPath(candidate) ??
      resetPasswordHrefFromBackendPath(pathnameFromUrl(withoutFragment))
    );
  }

  if (candidate === '/invite') {
    if (!query) {
      return candidate;
    }

    return normalizeAuthReturnToHref(`${candidate}?${query}`);
  }

  if (candidate === '/reset-password' && query) {
    return `${candidate}?${query}`;
  }

  return candidate === '/live-session' && query
    ? `${candidate}?${query}`
    : candidate;
}

function hasValidPercentEncoding(value: string): boolean {
  return !/%(?![0-9A-Fa-f]{2})/.test(value);
}

function isOpaqueHandoffId(value: string | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{8,128}$/.test(value));
}

function resetPasswordHrefFromBackendPath(candidate: string): string | null {
  const match = candidate.match(/^\/users\/reset-password\/([^/]+)$/);
  const token = decodeResetPasswordPathToken(match?.[1]?.trim() ?? '');

  return token ? `/reset-password?token=${encodeURIComponent(token)}` : null;
}

function decodeResetPasswordPathToken(token: string): string {
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

function pathnameFromUrl(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return '';
  }
}
