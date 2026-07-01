import { Redirect, Stack, usePathname } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';
import { ViewerBootstrap } from '../../src/auth/ViewerBootstrap';
import { authRouteHref } from '../../src/config/runtime';

export default function AppLayout() {
  const { state } = useAuth();
  const pathname = usePathname();

  if (state.status === 'loading') {
    return null;
  }

  if (state.status === 'unauthenticated') {
    return <Redirect href={authRouteHref('/sign-in', pathname)} />;
  }

  return (
    <ViewerBootstrap>
      <Stack
        initialRouteName="home"
        screenOptions={{
          headerShown: false,
        }}
      />
    </ViewerBootstrap>
  );
}
