import { StyleSheet } from 'react-native';

import { radius, spacing, typography } from '../../theme/tokens';

export const profileScreenStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  backButton: {
    width: '100%',
    maxWidth: 420,
  },
  identity: {
    alignItems: 'center',
    gap: spacing.md,
  },
  identityForm: {
    gap: spacing.sm,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: typography.label,
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  socialStat: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: typography.label,
  privacyPanel: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  summaryPanel: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sectionHeading: {
    gap: spacing.xs,
  },
  sectionTitle: typography.label,
  bodyText: typography.body,
  errorText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressedRow: {
    opacity: 0.78,
  },
  requestRow: {
    minHeight: 104,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  requestIdentity: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  smallAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAvatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: typography.label,
  rowSubtitle: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowActionButton: {
    flex: 1,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
  unavailableScreen: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  unavailableBackButton: {
    marginHorizontal: spacing.lg,
  },
});
