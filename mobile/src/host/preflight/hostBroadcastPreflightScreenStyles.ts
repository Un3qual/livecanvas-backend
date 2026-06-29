import { StyleSheet } from 'react-native';

import { radius, spacing, typography } from '../../theme/tokens';

export const hostBroadcastPreflightScreenStyles = StyleSheet.create({
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
  errorText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  controls: {
    gap: spacing.sm,
  },
});

