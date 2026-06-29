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
  const {
    getAccessToken,
    registerBeforeUnauthenticated,
    state: { status: authStatus },
  } = auth;
  const previousAuthStatusRef = useRef<HostBroadcastPublishingAuthStatus>(
    authStatus,
  );
  const storeRef = useRef<HostBroadcastPublishingSessionStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createHostBroadcastPublishingSessionStore();
  }

  const store = storeRef.current;

  useEffect(
    () =>
      registerBeforeUnauthenticated(async () => {
        await releaseHostBroadcastPublishingBeforeAuthLoss({
          apiBaseUrl: environment.apiBaseUrl,
          getAccessToken,
          store,
        });
      }),
    [environment.apiBaseUrl, getAccessToken, registerBeforeUnauthenticated, store],
  );

  useEffect(() => {
    releaseHostBroadcastPublishingAfterAuthStateChange(
      previousAuthStatusRef.current,
      authStatus,
      store,
    );
    previousAuthStatusRef.current = authStatus;
  }, [authStatus, store]);

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
