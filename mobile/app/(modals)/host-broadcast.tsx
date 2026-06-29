import { Redirect } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';
import { ScreenState } from '../../src/components/ScreenState';
import { authRouteHref } from '../../src/config/runtime';
import { HostBroadcastPreflightScreen } from '../../src/host/preflight/HostBroadcastPreflightScreen';

export default function HostBroadcastModal() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return <ScreenState state="loading" message="Restoring your session..." />;
  }

  if (state.status === 'unauthenticated') {
    return <Redirect href={authRouteHref('/sign-in', '/host-broadcast')} />;
  }

  return <HostBroadcastPreflightScreen />;
}
