import React, { useMemo } from 'react';
import { RelayEnvironmentProvider as RelayProvider } from 'react-relay';
import { useAuth } from '../auth/AuthProvider';
import { createAuthenticatedFetch } from '../auth/authenticatedFetch';
import { useStartupState } from '../providers/StartupGate';
import { createRelayEnvironment } from './environment';

export function RelayEnvironmentProvider({ children }: { children: React.ReactNode }) {
  const { environment } = useStartupState();
  const { signOut } = useAuth();

  const relayEnvironment = useMemo(() => {
    const fetchFn = createAuthenticatedFetch(environment.apiBaseUrl, () => {
      signOut();
    });
    return createRelayEnvironment(environment.apiBaseUrl, fetchFn);
  }, [environment.apiBaseUrl, signOut]);

  return <RelayProvider environment={relayEnvironment}>{children}</RelayProvider>;
}
