import { Stack } from 'expo-router';

import { AppProviders } from '../src/providers/AppProviders';
import { useAppTheme } from '../src/providers/ThemeProvider';

function RootNavigator() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
