import { useLocalSearchParams } from 'expo-router';

import { RelayRouteBoundary } from '../../../../src/components/RelayRouteBoundary';
import { ScreenState } from '../../../../src/components/ScreenState';
import { ProfileConnectionListScreen } from '../../../../src/profile/ProfileConnectionListScreen';
import { readOptionalProfileIdParam } from '../../../../src/profile/profileRouteParams';

export default function OtherProfileFollowingRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const profileId = readOptionalProfileIdParam(params.id);

  if (!profileId) {
    return <ScreenState state="empty" message="Profile link is invalid." />;
  }

  return (
    <RelayRouteBoundary
      loadingMessage="Loading following..."
      errorMessage="We could not load following."
    >
      <ProfileConnectionListScreen
        kind="otherFollowing"
        profileId={profileId}
      />
    </RelayRouteBoundary>
  );
}
