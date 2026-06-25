import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';

import { useAuth } from '../auth/AuthProvider';
import {
  createHostBroadcastPublishingSessionStore,
  releaseHostBroadcastPublishingAfterAuthStateChange,
  type HostBroadcastPublishingAuthStatus,
  type HostBroadcastPublishingSessionStore,
} from './hostBroadcastPublishingSession';

const HostBroadcastPublishingSessionContext =
  createContext<HostBroadcastPublishingSessionStore | null>(null);

export function HostBroadcastPublishingSessionProvider({
  children,
}: PropsWithChildren) {
  const auth = useAuth();
  const previousAuthStatusRef = useRef<HostBroadcastPublishingAuthStatus>(
    auth.state.status,
  );
  const storeRef = useRef<HostBroadcastPublishingSessionStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createHostBroadcastPublishingSessionStore();
  }

  const store = storeRef.current;

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
