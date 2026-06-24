import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';

import {
  createHostBroadcastPublishingSessionStore,
  type HostBroadcastPublishingSessionStore,
} from './hostBroadcastPublishingSession';

const HostBroadcastPublishingSessionContext =
  createContext<HostBroadcastPublishingSessionStore | null>(null);

export function HostBroadcastPublishingSessionProvider({
  children,
}: PropsWithChildren) {
  const storeRef = useRef<HostBroadcastPublishingSessionStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createHostBroadcastPublishingSessionStore();
  }

  const store = storeRef.current;

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
