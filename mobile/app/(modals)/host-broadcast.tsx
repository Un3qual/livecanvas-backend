import { Redirect } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';
import { authRouteHref } from '../../src/config/runtime';
import { HostBroadcastPreflightScreen } from '../../src/host/HostBroadcastPreflightScreen';

export default function HostBroadcastModal() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return null;
  }

  if (state.status === 'unauthenticated') {
    return <Redirect href={authRouteHref('/sign-in', '/host-broadcast')} />;
  }

  return <HostBroadcastPreflightScreen />;
}
