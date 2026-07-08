import { RelayRouteBoundary } from '../../src/components/RelayRouteBoundary';
import { ContactDiscoveryScreen } from '../../src/contacts/ContactDiscoveryScreen';

export default function ContactsRoute() {
  return (
    <RelayRouteBoundary
      loadingMessage="Loading contacts..."
      errorMessage="We could not load contact discovery."
    >
      <ContactDiscoveryScreen />
    </RelayRouteBoundary>
  );
}
