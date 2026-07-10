import { RelayRouteBoundary } from '../../../src/components/RelayRouteBoundary';
import { ProfileConnectionListScreen } from '../../../src/profile/ProfileConnectionListScreen';

export default function ViewerFollowersRoute() {
  return (
    <RelayRouteBoundary
      loadingMessage="Loading followers..."
      errorMessage="We could not load followers."
    >
      <ProfileConnectionListScreen kind="viewerFollowers" />
    </RelayRouteBoundary>
  );
}
