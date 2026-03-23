import { Redirect } from 'expo-router';

import { useStartupState } from '../src/providers/StartupGate';

export default function RootIndex() {
  const { snapshot } = useStartupState();

  return <Redirect href={snapshot.landingHref} />;
}
