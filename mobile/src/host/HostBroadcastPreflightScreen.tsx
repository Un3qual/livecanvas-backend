import { useEffect, useMemo, useReducer } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { useAppTheme } from '../providers/ThemeProvider';
import { radius, spacing, typography } from '../theme/tokens';
import {
  canGoLiveFromHostPreflight,
  createHostBroadcastPreflightState,
  hostBroadcastPreflightBlockers,
  hostBroadcastPreflightReducer,
  type HostBroadcastPermissionState,
} from './hostBroadcastPreflight';
import { createUnavailableHostBroadcastNative } from './hostBroadcastNative';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  statusList: {
    gap: spacing.sm,
  },
  statusRow: {
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  statusHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statusLabel: {
    ...typography.label,
    flex: 1,
  },
  statusValue: typography.body,
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: typography.label,
  bodyText: typography.body,
  controls: {
    gap: spacing.sm,
  },
});

export function HostBroadcastPreflightScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const native = useMemo(() => createUnavailableHostBroadcastNative(), []);
  const [preflightState, dispatchPreflightAction] = useReducer(
    hostBroadcastPreflightReducer,
    createHostBroadcastPreflightState(),
  );
  const blockers = hostBroadcastPreflightBlockers(preflightState);
  const canGoLive = canGoLiveFromHostPreflight(preflightState);

  useEffect(() => {
    let isMounted = true;

    async function refreshNativeReadiness() {
      const [permissions, preview] = await Promise.all([
        native.requestPermissions(),
        native.preparePreview(),
      ]);

      if (!isMounted) {
        return;
      }

      dispatchPreflightAction({
        permission: 'camera',
        state: permissions.camera,
        type: 'permission_changed',
      });
      dispatchPreflightAction({
        permission: 'microphone',
        state: permissions.microphone,
        type: 'permission_changed',
      });
      dispatchPreflightAction({
        ready: preview.status !== 'native_media_unavailable',
        type: 'native_media_changed',
      });
    }

    void refreshNativeReadiness();

    return () => {
      isMounted = false;
      native.dispose();
    };
  }, [native]);

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

      <AppCard>
        <SectionHeading title="Preflight readiness" />
        <View style={styles.statusList}>
          <StatusRow
            detail="Camera access"
            label="Camera"
            state={permissionStatus(preflightState.cameraPermission)}
          />
          <StatusRow
            detail="Microphone access"
            label="Microphone"
            state={permissionStatus(preflightState.microphonePermission)}
          />
          <StatusRow
            detail="Native preview"
            label="Native media"
            state={
              preflightState.nativeMediaReady
                ? readyStatus()
                : pendingStatus('Unavailable')
            }
          />
          <StatusRow
            detail="Backend negotiation"
            label="Media signaling"
            state={
              preflightState.backendMediaContractReady
                ? readyStatus()
                : pendingStatus('Pending')
            }
          />
        </View>
      </AppCard>

      <AppCard>
        <SectionHeading title="Host controls" />
        <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
          {blockers.length > 0
            ? 'Host broadcast is waiting on preflight readiness.'
            : 'Host broadcast preflight is ready.'}
        </Text>
        <View style={styles.controls}>
          <AppButton
            disabled={!canGoLive}
            label="Go live"
            onPress={() => {}}
          />
          <AppButton
            label="Go back"
            onPress={() => router.back()}
            variant="secondary"
          />
        </View>
      </AppCard>
    </ScrollView>
  );
}

type StatusState = {
  readonly label: string;
  readonly tone: 'ready' | 'pending' | 'blocked';
};

function permissionStatus(
  permission: HostBroadcastPermissionState,
): StatusState {
  switch (permission) {
    case 'granted':
      return readyStatus();
    case 'denied':
      return { label: 'Denied', tone: 'blocked' };
    case 'blocked':
      return { label: 'Blocked', tone: 'blocked' };
    case 'unknown':
      return pendingStatus('Unknown');
  }
}

function readyStatus(): StatusState {
  return { label: 'Ready', tone: 'ready' };
}

function pendingStatus(label: string): StatusState {
  return { label, tone: 'pending' };
}

function SectionHeading({ title }: { title: string }) {
  const theme = useAppTheme();

  return (
    <Text style={[styles.statusLabel, { color: theme.colors.text }]}>
      {title}
    </Text>
  );
}

function StatusRow({
  detail,
  label,
  state,
}: {
  detail: string;
  label: string;
  state: StatusState;
}) {
  const theme = useAppTheme();
  const badgeColors =
    state.tone === 'ready'
      ? {
          background: theme.colors.surfaceMuted,
          text: theme.colors.accent,
        }
      : state.tone === 'blocked'
        ? {
            background: theme.colors.errorMuted,
            text: theme.colors.error,
          }
        : {
            background: theme.colors.surfaceMuted,
            text: theme.colors.textMuted,
          };

  return (
    <View style={[styles.statusRow, { borderColor: theme.colors.border }]}>
      <View style={styles.statusHeader}>
        <Text style={[styles.statusLabel, { color: theme.colors.text }]}>
          {label}
        </Text>
        <View
          style={[styles.badge, { backgroundColor: badgeColors.background }]}
        >
          <Text style={[styles.badgeText, { color: badgeColors.text }]}>
            {state.label}
          </Text>
        </View>
      </View>
      <Text style={[styles.statusValue, { color: theme.colors.textMuted }]}>
        {detail}
      </Text>
    </View>
  );
}
