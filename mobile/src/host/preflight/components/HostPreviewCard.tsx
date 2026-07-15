import { Text, View } from 'react-native';

import { AppCard } from '../../../components/AppCard';
import { LiveWebRtcRTCView } from '../../../live/media/liveWebRtcAdapter';
import { useAppTheme } from '../../../providers/ThemeProvider';
import { hostBroadcastPreflightScreenStyles as styles } from '../hostBroadcastPreflightScreenStyles';

export type HostPreviewCardProps = {
  readonly nativeMediaReady: boolean;
  readonly previewStreamUrl: string | null;
};

export function HostPreviewCard({
  nativeMediaReady,
  previewStreamUrl,
}: HostPreviewCardProps) {
  const theme = useAppTheme();
  const PreviewView = LiveWebRtcRTCView;

  return (
    <AppCard>
      <Text style={[styles.statusLabel, { color: theme.colors.text }]}>
        Camera preview
      </Text>
      <View
        style={[
          styles.previewFrame,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {nativeMediaReady && previewStreamUrl && PreviewView ? (
          <PreviewView
            mirror
            objectFit="cover"
            streamURL={previewStreamUrl}
            style={styles.previewVideo}
          />
        ) : (
          <Text
            style={[styles.previewFallback, { color: theme.colors.textMuted }]}
          >
            {nativeMediaReady
              ? 'Camera preview is unavailable on this device.'
              : 'Camera preview will appear after camera and microphone access is ready.'}
          </Text>
        )}
      </View>
    </AppCard>
  );
}
