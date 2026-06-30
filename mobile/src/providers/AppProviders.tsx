import { useState, type PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  resolveEnvironment,
  type AppEnvironment,
} from '../config/environment';
import { AuthProvider } from '../auth/AuthProvider';
import { HostBroadcastPublishingSessionProvider } from '../host/HostBroadcastPublishingSessionProvider';
import { RelayEnvironmentProvider } from '../relay/RelayEnvironmentProvider';
import { StartupGate } from './StartupGate';
import { ThemeProvider } from './ThemeProvider';

export function AppProviders({ children }: PropsWithChildren) {
  const [environment] = useState<AppEnvironment>(() => resolveEnvironment());

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <EnvironmentProviders environment={environment}>
          {children}
        </EnvironmentProviders>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function EnvironmentProviders({
  children,
  environment,
}: PropsWithChildren<{ readonly environment: AppEnvironment }>) {
  return (
    <AuthProvider apiBaseUrl={environment.apiBaseUrl}>
      <StartupGate environment={environment}>
        <SessionProviders>{children}</SessionProviders>
      </StartupGate>
    </AuthProvider>
  );
}

function SessionProviders({ children }: PropsWithChildren) {
  return (
    <HostBroadcastPublishingSessionProvider>
      <RelayEnvironmentProvider>{children}</RelayEnvironmentProvider>
    </HostBroadcastPublishingSessionProvider>
  );
}
