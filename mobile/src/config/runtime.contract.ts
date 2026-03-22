import { resolveEnvironment } from './environment';
import { bootstrapRuntime, routeHrefFromUrl } from './runtime';

async function assertRuntimeContract() {
  const environment = resolveEnvironment({
    EXPO_PUBLIC_API_BASE_URL: 'http://localhost:4000',
    EXPO_PUBLIC_WEBSOCKET_URL: 'ws://localhost:4000/socket',
    EXPO_PUBLIC_BOOT_SESSION_STATE: 'forced_logout',
  });

  const snapshot = await bootstrapRuntime(environment, {
    getInitialUrl: async () => 'livecanvas-mobile://profile',
  });

  const deepLinkHref = routeHrefFromUrl('livecanvas-mobile://live-session');

  return { snapshot, deepLinkHref };
}

void assertRuntimeContract;
