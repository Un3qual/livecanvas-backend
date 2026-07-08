import { Suspense } from 'react';

import { ScreenState } from '../../src/components/ScreenState';
import { ContactDiscoveryScreen } from '../../src/contacts/ContactDiscoveryScreen';

export default function ContactsRoute() {
  return (
    <Suspense
      fallback={<ScreenState state="loading" message="Loading contacts..." />}
    >
      <ContactDiscoveryScreen />
    </Suspense>
  );
}
