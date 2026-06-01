import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';
import { ScreenState } from '../../src/components/ScreenState';
import { authRouteHref } from '../../src/config/runtime';
import { readLiveSessionIdParam } from '../../src/live/liveSessionNavigation';
import { LiveSessionWatchScreen } from '../../src/live/LiveSessionWatchScreen';

export default function LiveSessionModal() {
  const { state } = useAuth();
  const { sessionId: rawSessionId } = useLocalSearchParams<{
    sessionId?: string | string[];
  }>();

  if (state.status === 'loading') {
    return null;
  }

  const sessionId = readLiveSessionIdParam(rawSessionId);
  const returnToHref = sessionId
    ? `/live-session?sessionId=${encodeURIComponent(sessionId)}`
    : '/live-session';

  if (state.status === 'unauthenticated') {
    return <Redirect href={authRouteHref('/sign-in', returnToHref)} />;
  }

  if (!sessionId) {
    return (
      <ScreenState
        state="error"
        message="Choose a live session to continue."
      />
    );
  }

  return <LiveSessionWatchScreen sessionId={sessionId} />;
}
