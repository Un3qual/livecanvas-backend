import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';

import { useAuth } from '../auth/AuthProvider';
import { useStartupState } from '../providers/StartupGate';
import {
  releaseHostBroadcastPublishingAfterAuthStateChange,
  releaseHostBroadcastPublishingBeforeAuthLoss,
  type HostBroadcastPublishingAuthStatus,
} from './publishing/hostBroadcastPublishingAuthCleanup';
import {
  createHostBroadcastPublishingSessionStore,
  type HostBroadcastPublishingSessionStore,
} from './publishing/hostBroadcastPublishingSessionStore';

const HostBroadcastPublishingSessionContext =
  createContext<HostBroadcastPublishingSessionStore | null>(null);

export function HostBroadcastPublishingSessionProvider({
  children,
}: PropsWithChildren) {
  const auth = useAuth();
  const { environment } = useStartupState();
  const previousAuthStatusRef = useRef<HostBroadcastPublishingAuthStatus>(
    auth.state.status,
  );
  const storeRef = useRef<HostBroadcastPublishingSessionStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createHostBroadcastPublishingSessionStore();
  }

  const store = storeRef.current;

  useEffect(
    () =>
      auth.registerBeforeUnauthenticated(async () => {
        await releaseHostBroadcastPublishingBeforeAuthLoss({
          apiBaseUrl: environment.apiBaseUrl,
          getAccessToken: auth.getAccessToken,
          store,
        });
      }),
    [auth.getAccessToken, auth.registerBeforeUnauthenticated, environment.apiBaseUrl, store],
  );

  useEffect(() => {
    releaseHostBroadcastPublishingAfterAuthStateChange(
      previousAuthStatusRef.current,
      auth.state.status,
      store,
    );
    previousAuthStatusRef.current = auth.state.status;
  }, [auth.state.status, store]);

  useEffect(() => {
    return () => {
      store.releaseAll();
    };
  }, [store]);

  const value = useMemo(() => store, [store]);

  return (
    <HostBroadcastPublishingSessionContext.Provider value={value}>
      {children}
    </HostBroadcastPublishingSessionContext.Provider>
  );
}

export function useHostBroadcastPublishingSessions(): HostBroadcastPublishingSessionStore {
  const store = useContext(HostBroadcastPublishingSessionContext);

  if (!store) {
    throw new Error(
      'useHostBroadcastPublishingSessions must be used inside HostBroadcastPublishingSessionProvider',
    );
  }

  return store;
}
