import { useState, type PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  resolveEnvironment,
  type AppEnvironment,
} from '../config/environment';
import { AuthProvider } from '../auth/AuthProvider';
import { RelayEnvironmentProvider } from '../relay/RelayEnvironmentProvider';
import { StartupGate } from './StartupGate';
import { ThemeProvider } from './ThemeProvider';

export function AppProviders({ children }: PropsWithChildren) {
  const [environment] = useState<AppEnvironment>(() => resolveEnvironment());

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StartupGate environment={environment}>
          {/* Keep future channel providers outside the router tree seam. */}
          <AuthProvider>
            <RelayEnvironmentProvider>{children}</RelayEnvironmentProvider>
          </AuthProvider>
        </StartupGate>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
