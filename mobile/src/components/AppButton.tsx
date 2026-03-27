import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '../providers/ThemeProvider';
import { typography, spacing, radius, touchTarget } from '../theme/tokens';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
};

/**
 * Shell-level button with primary and secondary variants.
 * Sized to meet Apple HIG touch-target minimums.
 */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  style,
}: AppButtonProps) {
  const theme = useAppTheme();

  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isPrimary
            ? theme.colors.accent
            : theme.colors.surfaceMuted,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: isPrimary
              ? theme.colors.accentText
              : theme.colors.text,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: typography.label,
});
