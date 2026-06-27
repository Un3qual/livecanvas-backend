import React, { useMemo } from 'react';
import { RelayEnvironmentProvider as RelayProvider } from 'react-relay';

import { useAuth } from '../auth/AuthProvider';
import { createAuthenticatedFetch } from '../auth/authenticatedFetch';
import { useStartupState } from '../providers/StartupGate';
import { createRelayEnvironment } from './environment';

export function RelayEnvironmentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { environment } = useStartupState();
  const { state, onForcedLogout, syncTokens, getAuthStatus } = useAuth();
  const authStatus = state.status;

  const relayEnvironment = useMemo(() => {
    // Rebuild the Relay store when auth transitions between loading,
    // authenticated, and unauthenticated so cached records do not leak across
    // same-process logout/login boundaries.
    void authStatus;
    const fetchFn = createAuthenticatedFetch(
      environment.apiBaseUrl,
      onForcedLogout,
      syncTokens,
      getAuthStatus,
    );
    return createRelayEnvironment(environment.apiBaseUrl, fetchFn);
  }, [
    authStatus,
    environment.apiBaseUrl,
    getAuthStatus,
    onForcedLogout,
    syncTokens,
  ]);

  return (
    <RelayProvider environment={relayEnvironment}>
      {children}
    </RelayProvider>
  );
}
