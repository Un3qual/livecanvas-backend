import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';

export default function AppLayout() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return null;
  }

  if (state.status === 'unauthenticated') {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
