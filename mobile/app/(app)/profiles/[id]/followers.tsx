import { useLocalSearchParams } from 'expo-router';

import { RelayRouteBoundary } from '../../../../src/components/RelayRouteBoundary';
import { ScreenState } from '../../../../src/components/ScreenState';
import { ProfileConnectionListScreen } from '../../../../src/profile/ProfileConnectionListScreen';
import { readOptionalProfileIdParam } from '../../../../src/profile/profileRouteParams';

export default function OtherProfileFollowersRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const profileId = readOptionalProfileIdParam(params.id);

  if (!profileId) {
    return <ScreenState state="empty" message="Profile link is invalid." />;
  }

  return (
    <RelayRouteBoundary
      loadingMessage="Loading followers..."
      errorMessage="We could not load followers."
    >
      <ProfileConnectionListScreen
        kind="otherFollowers"
        profileId={profileId}
      />
    </RelayRouteBoundary>
  );
}
