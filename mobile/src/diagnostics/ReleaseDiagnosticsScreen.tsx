import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { useAuth } from '../auth/AuthProvider';
import { useStartupState } from '../providers/StartupGate';
import { useAppTheme } from '../providers/ThemeProvider';
import { spacing, typography } from '../theme/tokens';
import {
  type DiagnosticsEndpointPresentation,
  type DiagnosticsProbeStatus,
} from './releaseDiagnosticsPresentation';
import {
  createReleaseDiagnosticsScreenModel,
  type DiagnosticsProbeRow,
  type DiagnosticsStateRow,
  type ReleaseDiagnosticsScreenModel,
} from './releaseDiagnosticsScreenModel';
import {
  runApiReachabilityProbe,
  runWebsocketReachabilityProbe,
} from './releaseDiagnosticsProbes';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  sectionTitle: typography.label,
  row: {
    gap: spacing.xs,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  label: typography.label,
  value: typography.body,
  warning: {
    ...typography.body,
    fontSize: 14,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    ...typography.label,
  },
  probeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
});

export function ReleaseDiagnosticsScreen() {
  const { environment, snapshot } = useStartupState();
  const auth = useAuth();
  const [apiProbeStatus, setApiProbeStatus] = useState<DiagnosticsProbeStatus>({
    status: 'idle',
  });
  const [websocketProbeStatus, setWebsocketProbeStatus] =
    useState<DiagnosticsProbeStatus>({
      status: 'idle',
    });

  const model = createReleaseDiagnosticsScreenModel({
    apiProbeStatus,
    authStatus: auth.state.status,
    environment,
    snapshot,
    websocketProbeStatus,
  });

  async function checkApi() {
    setApiProbeStatus({ status: 'checking' });
    try {
      setApiProbeStatus(await runApiReachabilityProbe({
        apiBaseUrl: environment.apiBaseUrl,
      }));
    } catch {
      setApiProbeStatus({
        status: 'failed',
        reason: 'API probe failed',
      });
    }
  }

  async function checkWebsocket() {
    setWebsocketProbeStatus({ status: 'checking' });
    try {
      setWebsocketProbeStatus(await runWebsocketReachabilityProbe({
        getAccessToken: auth.getAccessToken,
        websocketUrl: environment.websocketUrl,
      }));
    } catch {
      setWebsocketProbeStatus({
        status: 'failed',
        reason: 'Websocket probe failed',
      });
    }
  }

  return (
    <ReleaseDiagnosticsView
      model={model}
      onCheckApi={checkApi}
      onCheckWebsocket={checkWebsocket}
    />
  );
}

function ReleaseDiagnosticsView({
  model,
  onCheckApi,
  onCheckWebsocket,
}: {
  model: ReleaseDiagnosticsScreenModel;
  onCheckApi: () => void;
  onCheckWebsocket: () => void;
}) {
  const theme = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <AppHeader
        eyebrow="Release diagnostics"
        title="Runtime checks"
        subtitle="Verify preview endpoint configuration and basic connectivity."
      />

      <AppCard>
        <SectionTitle title="Endpoint configuration" />
        {model.endpointRows.map((row) => (
          <EndpointRow key={row.label} row={row} />
        ))}
      </AppCard>

      <AppCard>
        <SectionTitle title="Startup snapshot" />
        {model.stateRows.map((row) => (
          <StateRow key={row.label} row={row} />
        ))}
      </AppCard>

      <AppCard>
        <SectionTitle title="Reachability probes" />
        <ProbeRow
          onPress={onCheckApi}
          row={model.probeRows[0]}
        />
        <ProbeRow
          onPress={onCheckWebsocket}
          row={model.probeRows[1]}
        />
      </AppCard>
    </ScrollView>
  );
}

function EndpointRow({ row }: { row: DiagnosticsEndpointPresentation }) {
  const theme = useAppTheme();

  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>
          {row.label}
        </Text>
        <Text style={[styles.value, { color: theme.colors.text }]}>
          {row.value}
        </Text>
        {row.warning ? (
          <Text style={[styles.warning, { color: theme.colors.accent }]}>
            {row.warning}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.badge,
          {
            backgroundColor: theme.colors.surfaceMuted,
            color: theme.colors.text,
          },
        ]}
      >
        {row.badge}
      </Text>
    </View>
  );
}

function StateRow({ row }: { row: DiagnosticsStateRow }) {
  const theme = useAppTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>
        {row.label}
      </Text>
      <Text style={[styles.value, { color: theme.colors.text }]}>
        {row.value}
      </Text>
    </View>
  );
}

function ProbeRow({
  onPress,
  row,
}: {
  onPress: () => void;
  row: DiagnosticsProbeRow | undefined;
}) {
  const theme = useAppTheme();

  if (!row) {
    return null;
  }

  return (
    <View style={styles.probeRow}>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>
          {row.label}
        </Text>
        <Text style={[styles.value, { color: theme.colors.text }]}>
          {row.statusLabel}
        </Text>
      </View>
      <AppButton
        disabled={row.disabled}
        label={row.actionLabel}
        onPress={onPress}
        variant="secondary"
      />
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  const theme = useAppTheme();

  return (
    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
      {title}
    </Text>
  );
}
