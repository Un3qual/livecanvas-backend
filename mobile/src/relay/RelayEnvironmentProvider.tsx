import React, { useMemo } from 'react';
import { RelayEnvironmentProvider as RelayProvider } from 'react-relay';
import { createRelayEnvironment } from './environment';
import { useStartupState } from '../providers/StartupGate';

export function RelayEnvironmentProvider({ children }: { children: React.ReactNode }) {
  const { environment } = useStartupState();
  const relayEnvironment = useMemo(
    () => createRelayEnvironment(environment.apiBaseUrl),
    [environment.apiBaseUrl],
  );

  return <RelayProvider environment={relayEnvironment}>{children}</RelayProvider>;
}
