import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { useAppTheme } from '../providers/ThemeProvider';
import { formatProfileIdentity } from '../profile/profilePresentation';
import { radius, spacing, typography } from '../theme/tokens';
import {
  formatLiveSessionStatus,
  formatLiveSessionTiming,
  formatLiveSessionVisibility,
  type LiveSessionStatus,
  type LiveSessionVisibility,
} from './liveSessionPresentation';

export type LiveSessionSummary = {
  readonly endedAt?: string | null;
  readonly host: { readonly email?: string | null; readonly id: string };
  readonly id: string;
  readonly insertedAt: string;
  readonly startedAt?: string | null;
  readonly status: string;
  readonly visibility: string;
};

type LiveSessionSummaryCardProps = {
  buttonLabel: string;
  onPress: () => void;
  session: LiveSessionSummary;
};

export function LiveSessionSummaryCard({
  buttonLabel,
  onPress,
  session,
}: LiveSessionSummaryCardProps) {
  const theme = useAppTheme();
  const normalizedStatus = normalizeLiveSessionStatus(session.status);
  const status = formatLiveSessionStatus(normalizedStatus);
  const visibility = formatLiveSessionVisibility(
    normalizeLiveSessionVisibility(session.visibility),
  );
  const timing = formatLiveSessionTiming({
    endedAt: session.endedAt,
    insertedAt: session.insertedAt,
    startedAt: session.startedAt,
    status: normalizedStatus,
  });
  const hostIdentity = formatProfileIdentity(session.host);
  const badgeColors = badgeColorsForTone(status.tone, theme);

  return (
    <AppCard>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: badgeColors.surface }]}>
          <Text style={[styles.badgeText, { color: badgeColors.text }]}>
            {status.label}
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {hostIdentity.title}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Host
        </Text>
      </View>
      <View
        style={[
          styles.details,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.detailText, { color: theme.colors.text }]}>
          {timing}
        </Text>
        <Text style={[styles.detailText, { color: theme.colors.textMuted }]}>
          {visibility}
        </Text>
      </View>
      <AppButton label={buttonLabel} onPress={onPress} />
    </AppCard>
  );
}

function normalizeLiveSessionStatus(status: string): LiveSessionStatus {
  switch (status) {
    case 'STARTING':
    case 'LIVE':
    case 'ENDED':
      return status;
    default:
      return '%future added value';
  }
}

function normalizeLiveSessionVisibility(
  visibility: string,
): LiveSessionVisibility {
  switch (visibility) {
    case 'PUBLIC':
    case 'FOLLOWERS':
      return visibility;
    default:
      return '%future added value';
  }
}

function badgeColorsForTone(
  tone: ReturnType<typeof formatLiveSessionStatus>['tone'],
  theme: ReturnType<typeof useAppTheme>,
) {
  switch (tone) {
    case 'live':
      return {
        surface: theme.colors.accent,
        text: theme.colors.accentText,
      };
    case 'pending':
      return {
        surface: theme.colors.surfaceMuted,
        text: theme.colors.accent,
      };
    case 'ended':
      return {
        surface: theme.colors.errorMuted,
        text: theme.colors.error,
      };
  }
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: typography.label,
  body: {
    gap: spacing.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  details: {
    borderWidth: 1,
    borderRadius: radius.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  detailText: typography.body,
});
