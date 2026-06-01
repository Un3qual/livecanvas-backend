import { useLocalSearchParams } from 'expo-router';

import { ScreenState } from '../../src/components/ScreenState';
import { readLiveSessionIdParam } from '../../src/live/liveSessionNavigation';
import { LiveSessionWatchScreen } from '../../src/live/LiveSessionWatchScreen';

export default function LiveSessionModal() {
  const { sessionId: rawSessionId } = useLocalSearchParams<{
    sessionId?: string | string[];
  }>();
  const sessionId = readLiveSessionIdParam(rawSessionId);

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
