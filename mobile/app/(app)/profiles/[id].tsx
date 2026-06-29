import { Suspense } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { ScreenState } from '../../../src/components/ScreenState';
import { OtherUserProfileScreen } from '../../../src/profile/other/OtherUserProfileScreen';

export default function OtherUserProfileRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = readProfileId(params.id);

  if (!id) {
    return <ScreenState state="empty" message="Profile link is invalid." />;
  }

  return (
    <Suspense
      fallback={<ScreenState state="loading" message="Loading profile..." />}
    >
      <OtherUserProfileScreen id={id} />
    </Suspense>
  );
}

function readProfileId(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    if (value.length !== 1) {
      return null;
    }

    return readProfileId(value[0]);
  }

  const id = typeof value === 'string' ? value.trim() : '';

  if (id.length === 0) {
    return null;
  }

  return id;
}
