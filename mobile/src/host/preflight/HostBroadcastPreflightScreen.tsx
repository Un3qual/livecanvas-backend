import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { useMutation } from 'react-relay';

import { useAuth } from '../../auth/AuthProvider';
import { AppHeader } from '../../components/AppHeader';
import { liveSessionHref } from '../../live/liveSessionNavigation';
import { useAppTheme } from '../../providers/ThemeProvider';
import { useStartupState } from '../../providers/StartupGate';
import { useHostBroadcastPublishingSessions } from '../HostBroadcastPublishingSessionProvider';
import {
  HostControlsCard,
  PreflightReadinessCard,
} from './components/HostPreflightCards';
import {
  hostBroadcastPreflightScreenEndMutation,
  hostBroadcastPreflightScreenGoLiveMutation,
  hostBroadcastPreflightScreenPrepareMediaMutation,
  hostBroadcastPreflightScreenStartMutation,
  type HostBroadcastPreflightScreenEndMutation,
  type HostBroadcastPreflightScreenGoLiveMutation,
  type HostBroadcastPreflightScreenPrepareMediaMutation,
  type HostBroadcastPreflightScreenStartMutation,
} from './hostBroadcastPreflightOperations';
import { hostBroadcastPreflightScreenStyles as styles } from './hostBroadcastPreflightScreenStyles';
import { useHostBroadcastPreflightController } from './hooks/useHostBroadcastPreflightController';

export function HostBroadcastPreflightScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const auth = useAuth();
  const { environment } = useStartupState();
  const hostPublishingSessions = useHostBroadcastPublishingSessions();
  const [commitStartLiveSession] =
    useMutation<HostBroadcastPreflightScreenStartMutation>(
      hostBroadcastPreflightScreenStartMutation,
    );
  const [commitPrepareMedia] =
    useMutation<HostBroadcastPreflightScreenPrepareMediaMutation>(
      hostBroadcastPreflightScreenPrepareMediaMutation,
    );
  const [commitGoLive] =
    useMutation<HostBroadcastPreflightScreenGoLiveMutation>(
      hostBroadcastPreflightScreenGoLiveMutation,
    );
  const [commitEndLiveSession] =
    useMutation<HostBroadcastPreflightScreenEndMutation>(
      hostBroadcastPreflightScreenEndMutation,
    );
  const navigateBack = useCallback(() => {
    router.back();
  }, [router]);
  const navigateToLiveSession = useCallback(
    (liveSessionId: string) => {
      router.replace(liveSessionHref(liveSessionId));
    },
    [router],
  );
  const controller = useHostBroadcastPreflightController({
    authStatus: auth.state.status,
    commitEndLiveSession,
    commitGoLive,
    commitPrepareMedia,
    commitStartLiveSession,
    getAccessToken: auth.getAccessToken,
    hostPublishingSessions,
    navigateBack,
    navigateToLiveSession,
    websocketUrl: environment.websocketUrl,
  });

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <AppHeader
        eyebrow="Host"
        title="Host live session"
        subtitle="Check camera, microphone, and media readiness before going live."
      />

      <PreflightReadinessCard {...controller.readinessCardProps} />

      <HostControlsCard {...controller.controlsCardProps} />
    </ScrollView>
  );
}
