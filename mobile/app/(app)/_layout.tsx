import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
