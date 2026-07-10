import { RelayRouteBoundary } from '../../src/components/RelayRouteBoundary';
import { AccountSettingsScreen } from '../../src/account/AccountSettingsScreen';

export default function SettingsRoute() {
  return (
    <RelayRouteBoundary
      loadingMessage="Loading account settings..."
      errorMessage="We could not load account settings."
    >
      <AccountSettingsScreen />
    </RelayRouteBoundary>
  );
}
