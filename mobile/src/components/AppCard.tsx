import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { PropsWithChildren } from 'react';

import { useAppTheme } from '../providers/ThemeProvider';
import { spacing, radius } from '../theme/tokens';

type AppCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

/**
 * Themed card container. Renders a bordered surface panel with
 * consistent padding and radius used throughout the shell.
 */
export function AppCard({ children, style }: AppCardProps) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
