import { RelayRouteBoundary } from '../../../src/components/RelayRouteBoundary';
import { PendingFollowRequestsScreen } from '../../../src/profile/PendingFollowRequestsScreen';

export default function ViewerFollowRequestsRoute() {
  return (
    <RelayRouteBoundary
      loadingMessage="Loading follow requests..."
      errorMessage="We could not load follow requests."
    >
      <PendingFollowRequestsScreen />
    </RelayRouteBoundary>
  );
}
