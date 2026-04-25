import { useState, type PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  resolveEnvironment,
  type AppEnvironment,
} from '../config/environment';
import { AuthProvider } from '../auth/AuthProvider';
import { ViewerBootstrap } from '../auth/ViewerBootstrap';
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
            {/* Keep future channel providers outside the router tree seam. */}
            <RelayEnvironmentProvider>
              <ViewerBootstrap>{children}</ViewerBootstrap>
            </RelayEnvironmentProvider>
          </StartupGate>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
