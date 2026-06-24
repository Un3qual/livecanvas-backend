import { useState, type PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  resolveEnvironment,
  type AppEnvironment,
} from '../config/environment';
import { AuthProvider } from '../auth/AuthProvider';
import { ViewerBootstrap } from '../auth/ViewerBootstrap';
import { HostBroadcastPublishingSessionProvider } from '../host/HostBroadcastPublishingSessionProvider';
import { RelayEnvironmentProvider } from '../relay/RelayEnvironmentProvider';
import { StartupGate } from './StartupGate';
import { ThemeProvider } from './ThemeProvider';

export function AppProviders({ children }: PropsWithChildren) {
  const [environment] = useState<AppEnvironment>(() => resolveEnvironment());

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider apiBaseUrl={environment.apiBaseUrl}>
          <StartupGate environment={environment}>
            <HostBroadcastPublishingSessionProvider>
              <RelayEnvironmentProvider>
                <ViewerBootstrap>{children}</ViewerBootstrap>
              </RelayEnvironmentProvider>
            </HostBroadcastPublishingSessionProvider>
          </StartupGate>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
