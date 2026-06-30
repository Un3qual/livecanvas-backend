import { Stack } from 'expo-router';

import { ViewerBootstrap } from '../../src/auth/ViewerBootstrap';

export default function ModalLayout() {
  return (
    <ViewerBootstrap>
      <Stack
        screenOptions={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
    </ViewerBootstrap>
  );
}
