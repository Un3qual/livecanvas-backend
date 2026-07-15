import { useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { AppHeader } from '../../../components/AppHeader';
import type {
  HostBroadcastLocalMediaControls,
  HostBroadcastLocalMediaControlsSnapshot,
} from '../../../host/publishing/hostBroadcastLocalMediaControls';
import { formatProfileIdentity } from '../../../profile/profilePresentation';
import { useAppTheme } from '../../../providers/ThemeProvider';
import {
  badgeColorsForLiveStatusTone,
  formatLiveSessionTiming,
  formatLiveSessionVisibility,
  normalizeLiveSessionVisibility,
} from '../../liveSessionPresentation';
import type {
  formatLiveSessionStatus,
  LiveSessionStatus,
} from '../../liveSessionPresentation';
import {
  formatLiveSessionRecordingPresentation,
  normalizeLiveSessionRecordingPublicUrl,
} from '../../recording/liveSessionRecordingPresentation';
import { liveSessionWatchScreenStyles as styles } from '../liveSessionWatchScreenStyles';
import type { LiveSessionNode } from '../liveSessionWatchScreenTypes';

export type LiveSessionWatchHostMediaControl = Readonly<{
  label: string;
  onPress: () => void;
}>;

export type LiveSessionWatchHostMediaControlsProps = Readonly<{
  audio: LiveSessionWatchHostMediaControl | null;
  video: LiveSessionWatchHostMediaControl | null;
}>;

export type LiveSessionWatchHostMediaControlsOptions = Readonly<{
  controls: HostBroadcastLocalMediaControls | null;
  isHostOwnedSession: boolean;
  normalizedStatus: LiveSessionStatus;
  onSnapshotChanged: (
    snapshot: HostBroadcastLocalMediaControlsSnapshot,
  ) => void;
  snapshot: HostBroadcastLocalMediaControlsSnapshot | null;
}>;

export function createLiveSessionWatchHostMediaControls({
  controls,
  isHostOwnedSession,
  normalizedStatus,
  onSnapshotChanged,
  snapshot,
}: LiveSessionWatchHostMediaControlsOptions): LiveSessionWatchHostMediaControlsProps | null {
  if (
    !isHostOwnedSession ||
    normalizedStatus !== 'LIVE' ||
    !controls ||
    !snapshot
  ) {
    return null;
  }

  // Labels reflect the rendered snapshot; handlers reread controls so a press
  // toggles the latest media state instead of a stale prop snapshot.
  const audio = snapshot.audio.available
    ? {
        label: snapshot.audio.enabled ? 'Mute mic' : 'Unmute mic',
        onPress() {
          const currentSnapshot = controls.snapshot();
          controls.setAudioEnabled(!currentSnapshot.audio.enabled);
          onSnapshotChanged(controls.snapshot());
        },
      }
    : null;
  const video = snapshot.video.available
    ? {
        label: snapshot.video.enabled
          ? 'Turn camera off'
          : 'Turn camera on',
        onPress() {
          const currentSnapshot = controls.snapshot();
          controls.setVideoEnabled(!currentSnapshot.video.enabled);
          onSnapshotChanged(controls.snapshot());
        },
      }
    : null;

  if (!audio && !video) {
    return null;
  }

  return { audio, video };
}

const recordingOpenFailureCopy =
  'We could not open this recording. Try again in a moment.';

export function LiveSessionDetailsCard({
  normalizedStatus,
  session,
  status,
}: {
  normalizedStatus: LiveSessionStatus;
  session: LiveSessionNode;
  status: ReturnType<typeof formatLiveSessionStatus>;
}) {
  return (
    <AppCard>
      <SectionHeading title="Session details" />
      <MetadataRow label="Status" value={status.label} />
      <MetadataRow
        label="Visibility"
        value={formatLiveSessionVisibility(
          normalizeLiveSessionVisibility(session.visibility),
        )}
      />
      <MetadataRow
        label="Timing"
        value={formatLiveSessionTiming({
          endedAt: session.endedAt,
          insertedAt: session.insertedAt,
          startedAt: session.startedAt,
          status: normalizedStatus,
        })}
      />
      {session.recordingMediaAsset ? (
        <RecordingMetadata asset={session.recordingMediaAsset} />
      ) : null}
    </AppCard>
  );
}

export function LiveSessionWatchControlsCard({
  canEndLiveSession,
  enterable,
  hasActiveSubmission,
  hostControls,
  isEnding,
  isHostOwnedSession,
  isJoined,
  isJoining,
  isLeaving,
  normalizedStatus,
  onEndPress,
  onJoinPress,
  onLeavePress,
  watchError,
}: {
  canEndLiveSession: boolean;
  enterable: boolean;
  hasActiveSubmission: boolean;
  hostControls: LiveSessionWatchHostMediaControlsProps | null;
  isEnding: boolean;
  isHostOwnedSession: boolean;
  isJoined: boolean;
  isJoining: boolean;
  isLeaving: boolean;
  normalizedStatus: LiveSessionStatus;
  onEndPress: () => void;
  onJoinPress: () => void;
  onLeavePress: () => void;
  watchError: string | null;
}) {
  const theme = useAppTheme();
  const showViewerJoinControl = !isHostOwnedSession && !isJoined;

  return (
    <AppCard>
      <SectionHeading title="Watch controls" />
      {normalizedStatus === 'ENDED' ? (
        <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
          This live session has ended.
        </Text>
      ) : null}
      {isJoined ? (
        <Text style={[styles.bodyText, { color: theme.colors.text }]}>
          You are joined to this live session.
        </Text>
      ) : null}
      {isJoining ? (
        <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
          Joining live session...
        </Text>
      ) : null}
      {isLeaving ? (
        <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
          Leaving live session...
        </Text>
      ) : null}
      {isEnding ? (
        <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
          Ending live session...
        </Text>
      ) : null}
      {watchError ? (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {watchError}
        </Text>
      ) : null}
      {hostControls?.audio ? (
        <AppButton
          label={hostControls.audio.label}
          onPress={hostControls.audio.onPress}
          variant="secondary"
        />
      ) : null}
      {hostControls?.video ? (
        <AppButton
          label={hostControls.video.label}
          onPress={hostControls.video.onPress}
          variant="secondary"
        />
      ) : null}
      {isJoined ? (
        <AppButton
          disabled={isLeaving || hasActiveSubmission}
          label="Leave live"
          onPress={onLeavePress}
          variant="secondary"
        />
      ) : showViewerJoinControl ? (
        <AppButton
          disabled={!enterable || isJoining || hasActiveSubmission}
          label="Join live"
          onPress={onJoinPress}
        />
      ) : null}
      {canEndLiveSession ? (
        <AppButton
          disabled={isEnding || hasActiveSubmission}
          label={isEnding ? 'Ending live...' : 'End live'}
          onPress={onEndPress}
          variant="secondary"
        />
      ) : null}
    </AppCard>
  );
}

export function UnavailableLiveSession({ onBack }: { onBack: () => void }) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.unavailable,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <AppCard>
        <AppHeader
          eyebrow="Live"
          title="Live session unavailable"
          subtitle="This live session is not available to your account."
        />
        <AppButton label="Go back" onPress={onBack} variant="secondary" />
      </AppCard>
    </View>
  );
}

export function LiveSessionHero({
  isJoined,
  normalizedStatus,
  session,
  status,
  viewerCount,
}: {
  isJoined: boolean;
  normalizedStatus: LiveSessionStatus;
  session: LiveSessionNode;
  status: ReturnType<typeof formatLiveSessionStatus>;
  viewerCount: number | null;
}) {
  const theme = useAppTheme();
  const host = formatProfileIdentity(session.host);
  const badgeColors = badgeColorsForLiveStatusTone(status.tone, theme);

  return (
    <AppCard>
      <View style={styles.heroHeader}>
        <View style={[styles.badge, { backgroundColor: badgeColors.surface }]}>
          <Text style={[styles.badgeText, { color: badgeColors.text }]}>
            {status.label}
          </Text>
        </View>
        {isJoined ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <Text style={[styles.badgeText, { color: theme.colors.accent }]}>
              Joined
            </Text>
          </View>
        ) : null}
      </View>
      <AppHeader
        eyebrow="Live session"
        title={host.title}
        subtitle={formatLiveSessionTiming({
          endedAt: session.endedAt,
          insertedAt: session.insertedAt,
          startedAt: session.startedAt,
          status: normalizedStatus,
        })}
      />
      <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>Host</Text>
      {viewerCount != null ? (
        <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
          {viewerCount === 1 ? '1 viewer' : `${viewerCount} viewers`}
        </Text>
      ) : null}
    </AppCard>
  );
}

export function SectionHeading({ title }: { title: string }) {
  const theme = useAppTheme();

  return (
    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
      {title}
    </Text>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();

  return (
    <View style={[styles.metadataRow, { borderColor: theme.colors.border }]}>
      <Text style={[styles.metadataLabel, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
      <Text style={[styles.metadataValue, { color: theme.colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

function RecordingMetadata({
  asset,
}: {
  asset: LiveSessionNode['recordingMediaAsset'];
}) {
  const theme = useAppTheme();
  const [openError, setOpenError] = useState<string | null>(null);

  if (!asset) {
    return null;
  }

  const presentation = formatLiveSessionRecordingPresentation({
    processingState: asset.processingState,
    publicUrl: asset.publicUrl,
  });

  const handleOpenPress = () => {
    if (!presentation.publicUrl) {
      return;
    }

    setOpenError(null);
    const openRecording = openLiveSessionRecordingUrl(presentation.publicUrl);

    openRecording.catch(() => {
      setOpenError(recordingOpenFailureCopy);
    });
  };

  return (
    <View style={styles.recordingMetadata}>
      <SectionHeading title="Recording" />
      <MetadataRow label="Status" value={presentation.statusLabel} />
      <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
        {presentation.body}
      </Text>
      {presentation.canOpen ? (
        <AppButton
          label="Open recording"
          onPress={handleOpenPress}
          variant="secondary"
        />
      ) : null}
      {openError ? (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {openError}
        </Text>
      ) : null}
    </View>
  );
}

export async function openLiveSessionRecordingUrl(
  publicUrl: string,
): Promise<void> {
  const normalizedPublicUrl = normalizeLiveSessionRecordingPublicUrl(publicUrl);

  if (!normalizedPublicUrl) {
    throw new Error('Unsupported recording URL');
  }

  if (
    normalizedPublicUrl.protocol === 'http:' ||
    normalizedPublicUrl.protocol === 'https:'
  ) {
    await Linking.openURL(normalizedPublicUrl.publicUrl);
    return;
  }

  if (await Linking.canOpenURL(normalizedPublicUrl.publicUrl)) {
    await Linking.openURL(normalizedPublicUrl.publicUrl);
    return;
  }

  throw new Error('Unsupported recording URL');
}
