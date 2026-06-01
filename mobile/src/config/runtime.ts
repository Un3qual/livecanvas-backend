import { Linking } from 'react-native';

import type { AppEnvironment, BootSessionState } from './environment';

const KNOWN_ROUTE_HREFS = new Set([
  '/sign-in',
  '/sign-up',
  '/home',
  '/profile',
  '/live-session',
]);

const AUTH_ROUTE_HREFS = new Set(['/sign-in', '/sign-up']);

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

  return deriveStartupSnapshot(environment, initialUrl);
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
    return initialHref && initialRoutePath && AUTH_ROUTE_HREFS.has(initialRoutePath)
      ? initialHref
      : '/sign-in';
  }

  return initialHref && initialRoutePath && !AUTH_ROUTE_HREFS.has(initialRoutePath)
    ? initialHref
    : '/home';
}

function routePathFromHref(href: string): string {
  return href.split('?', 1)[0] ?? href;
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
    return null;
  }

  return candidate === '/live-session' && query
    ? `${candidate}?${query}`
    : candidate;
}
