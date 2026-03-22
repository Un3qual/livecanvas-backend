import { useState, type PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  resolveEnvironment,
  type AppEnvironment,
} from '../config/environment';
import { StartupGate } from './StartupGate';
import { ThemeProvider } from './ThemeProvider';

export function AppProviders({ children }: PropsWithChildren) {
  const [environment] = useState<AppEnvironment>(() => resolveEnvironment());

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {/* Keep future Relay/auth/channel providers outside the router tree seam. */}
        <StartupGate environment={environment}>{children}</StartupGate>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
