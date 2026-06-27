import { Text, View } from 'react-native';

import { AppCard } from '../../../components/AppCard';
import { LiveWebRtcRTCView } from '../../media/liveWebRtcAdapter';
import { useAppTheme } from '../../../providers/ThemeProvider';
import { liveSessionWatchScreenStyles as styles } from '../liveSessionWatchScreenStyles';
import type { ViewerPlaybackState } from '../liveSessionWatchScreenTypes';
import { SectionHeading } from './LiveSessionWatchCards';

export function LiveSessionViewerPlaybackSurface({
  isJoined,
  state,
}: {
  isJoined: boolean;
  state: ViewerPlaybackState;
}) {
  const theme = useAppTheme();
  const message = viewerPlaybackMessage(isJoined, state);
  const RTCViewComponent = LiveWebRtcRTCView;

  return (
    <AppCard>
      <SectionHeading title="Live video" />
      <View style={[styles.mediaFrame, { backgroundColor: '#050505' }]}>
        {state.remoteStreamUrl && RTCViewComponent ? (
          <RTCViewComponent
            objectFit="cover"
            streamURL={state.remoteStreamUrl}
            style={styles.remoteVideo}
          />
        ) : (
          <View style={styles.mediaPlaceholder}>
            <Text
              style={[
                styles.bodyText,
                {
                  color:
                    state.status === 'errored'
                      ? theme.colors.error
                      : theme.colors.surfaceMuted,
                  textAlign: 'center',
                },
              ]}
            >
              {message}
            </Text>
          </View>
        )}
      </View>
    </AppCard>
  );
}

function viewerPlaybackMessage(
  isJoined: boolean,
  state: ViewerPlaybackState,
): string {
  if (!isJoined) {
    return 'Join live to watch host video.';
  }

  if (state.error) {
    return state.error;
  }

  switch (state.status) {
    case 'preparing':
      return 'Preparing live video...';
    case 'connecting':
      return 'Connecting live video...';
    case 'waiting_for_host':
      return 'Waiting for host video...';
    case 'playing':
      return 'Live video is playing.';
    case 'closed':
      return 'Live video disconnected.';
    case 'errored':
      return 'Could not start live video playback. Please try again.';
    case 'idle':
    default:
      return 'Live video will start after you join.';
  }
}
