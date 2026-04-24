import { Redirect } from 'expo-router';

import { useAuth } from '../src/auth/AuthProvider';
import { resolveLandingHrefForAuth } from '../src/config/runtime';
import { useStartupState } from '../src/providers/StartupGate';

export default function RootIndex() {
  const { state } = useAuth();
  const { snapshot } = useStartupState();
  const landingHref = resolveLandingHrefForAuth(snapshot, state.status);

  if (!landingHref) {
    return null;
  }

  return <Redirect href={landingHref} />;
}
