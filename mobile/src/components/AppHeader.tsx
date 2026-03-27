import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../providers/ThemeProvider';
import { typography, spacing } from '../theme/tokens';

type AppHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

/**
 * Consistent screen header used across shell entry screens.
 * Renders an optional eyebrow label, a heading, and optional body text.
 */
export function AppHeader({ eyebrow, title, subtitle }: AppHeaderProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.root}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>
          {eyebrow}
        </Text>
      ) : null}
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  eyebrow: typography.eyebrow,
  title: typography.heading,
  subtitle: {
    ...typography.body,
    maxWidth: 320,
    textAlign: 'center',
  },
});
