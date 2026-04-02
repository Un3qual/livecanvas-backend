import React, { useMemo } from 'react';
import { RelayEnvironmentProvider as RelayProvider } from 'react-relay';
import { useAuth } from '../auth/AuthProvider';
import { createAuthenticatedFetch } from '../auth/authenticatedFetch';
import { useStartupState } from '../providers/StartupGate';
import { createRelayEnvironment } from './environment';

export function RelayEnvironmentProvider({ children }: { children: React.ReactNode }) {
  const { environment } = useStartupState();
  const { state, onForcedLogout, syncTokens } = useAuth();

  const relayEnvironment = useMemo(() => {
    // Rebuild the Relay store when auth transitions between loading,
    // authenticated, and unauthenticated so cached records do not leak across
    // same-process logout/login boundaries.
    const fetchFn = createAuthenticatedFetch(
      environment.apiBaseUrl,
      onForcedLogout,
      syncTokens,
    );
    return createRelayEnvironment(environment.apiBaseUrl, fetchFn);
  }, [environment.apiBaseUrl, onForcedLogout, state.status, syncTokens]);

  return <RelayProvider environment={relayEnvironment}>{children}</RelayProvider>;
}
