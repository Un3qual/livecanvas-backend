import { StyleSheet } from 'react-native';

import { radius, spacing, typography } from '../../theme/tokens';

export const liveSessionWatchScreenStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  unavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: typography.label,
  sectionTitle: typography.label,
  bodyText: typography.body,
  errorText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  mediaFrame: {
    alignItems: 'center',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  mediaPlaceholder: {
    padding: spacing.md,
  },
  remoteVideo: {
    height: '100%',
    width: '100%',
  },
  metadataRow: {
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  metadataLabel: {
    ...typography.label,
    fontSize: 12,
    lineHeight: 16,
  },
  metadataValue: typography.body,
  recordingMetadata: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
});

