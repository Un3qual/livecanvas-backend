import { RelayRouteBoundary } from '../../../src/components/RelayRouteBoundary';
import { ProfileConnectionListScreen } from '../../../src/profile/ProfileConnectionListScreen';

export default function ViewerFollowingRoute() {
  return (
    <RelayRouteBoundary
      loadingMessage="Loading following..."
      errorMessage="We could not load following."
    >
      <ProfileConnectionListScreen kind="viewerFollowing" />
    </RelayRouteBoundary>
  );
}
