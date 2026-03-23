import { Linking } from 'react-native';

import type { AppEnvironment, BootSessionState } from './environment';

const KNOWN_ROUTE_HREFS = new Set([
  '/sign-in',
  '/home',
  '/profile',
  '/live-session',
]);

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

export function routeHrefFromUrl(initialUrl: string | null): string | null {
  if (!initialUrl) {
    return null;
  }

  const withoutFragment = initialUrl.split('#', 1)[0] ?? '';
  const withoutQuery = withoutFragment.split('?', 1)[0] ?? '';
  const [, routeSource = withoutQuery] = withoutQuery.split('://', 2);

  // Expo deep links commonly encode the first route segment as the URL host.
  const candidate = `/${routeSource.replace(/^\/+/, '').replace(/\/+$/, '')}`;

  if (!candidate || candidate === '/') {
    return null;
  }

  return KNOWN_ROUTE_HREFS.has(candidate) ? candidate : null;
}
