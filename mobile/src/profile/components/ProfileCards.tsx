import { Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { ScreenState } from '../../components/ScreenState';
import { useAppTheme } from '../../providers/ThemeProvider';
import {
  formatPrivacyModeLabel,
  formatProfileIdentity,
} from '../profilePresentation';
import { ProfileAvatar } from './ProfileAvatar';
import { profileScreenStyles as styles } from './profileScreenStyles';

export function SummaryStat({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: string;
  variant?: 'default' | 'social';
}) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        variant === 'social' ? styles.socialStat : styles.stat,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.statValue, { color: theme.colors.text }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

export function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
        {subtitle}
      </Text>
    </View>
  );
}

export function ProfileSummaryCard({
  identity,
  privacy,
}: {
  identity: ReturnType<typeof formatProfileIdentity>;
  privacy: ReturnType<typeof formatPrivacyModeLabel>;
}) {
  const theme = useAppTheme();

  return (
    <AppCard>
      <View style={styles.identity}>
        <ProfileAvatar initials={identity.initials} />
        <AppHeader
          eyebrow="Profile"
          title={identity.title}
          subtitle={identity.subtitle}
        />
      </View>
      <View
        style={[
          styles.summaryPanel,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {privacy.label}
        </Text>
        <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
          {privacy.description}
        </Text>
      </View>
    </AppCard>
  );
}

export function SocialPreviewCard({
  followersPreviewCount,
  followingPreviewCount,
}: {
  followersPreviewCount: string;
  followingPreviewCount: string;
}) {
  const theme = useAppTheme();

  return (
    <AppCard>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Visible social preview
      </Text>
      <View style={styles.stats}>
        <SummaryStat
          label="Followers"
          value={followersPreviewCount}
          variant="social"
        />
        <SummaryStat
          label="Following"
          value={followingPreviewCount}
          variant="social"
        />
      </View>
    </AppCard>
  );
}

export function EmptyCardMessage({ message }: { message: string }) {
  const theme = useAppTheme();

  return (
    <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
      {message}
    </Text>
  );
}

export function UnavailableProfileScreen({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.unavailableScreen,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <AppButton
        label="Back"
        onPress={onBack}
        style={styles.unavailableBackButton}
        variant="secondary"
      />
      <ScreenState state="empty" message={message} />
    </View>
  );
}

