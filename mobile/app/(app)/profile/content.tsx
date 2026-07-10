import { useLocalSearchParams } from 'expo-router';

import { RelayRouteBoundary } from '../../../src/components/RelayRouteBoundary';
import { ScreenState } from '../../../src/components/ScreenState';
import { ProfileContentListScreen } from '../../../src/profile/ProfileContentListScreen';
import { readProfileContentKindParam } from '../../../src/profile/profileContentRouteParams';
import { readOptionalProfileIdParam } from '../../../src/profile/profileRouteParams';

export default function ViewerProfileContentRoute() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    kind?: string | string[];
  }>();
  const profileId = readOptionalProfileIdParam(params.id);
  const kind = readProfileContentKindParam(params.kind);

  if (!profileId || !kind) {
    return <ScreenState state="empty" message="Profile link is invalid." />;
  }

  return (
    <RelayRouteBoundary
      errorMessage={`We could not load ${kind}.`}
      loadingMessage={`Loading ${kind}...`}
    >
      {(queryFetchKey) => (
        <ProfileContentListScreen
          kind={kind}
          profileId={profileId}
          queryFetchKey={queryFetchKey}
        />
      )}
    </RelayRouteBoundary>
  );
}
