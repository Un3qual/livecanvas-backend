import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '../providers/ThemeProvider';
import { typography, spacing, radius, touchTarget } from '../theme/tokens';

type AppButtonProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  selected?: boolean;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
};

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

/**
 * Shell-level button with primary and secondary variants.
 * Sized to meet Apple HIG touch-target minimums.
 */
export function AppButton({
  accessibilityLabel,
  disabled = false,
  label,
  onPress,
  selected,
  variant = 'primary',
  style,
}: AppButtonProps) {
  const theme = useAppTheme();

  const isPrimary = variant === 'primary';
  const accessibilityState =
    selected === undefined ? { disabled } : { disabled, selected };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isPrimary
            ? theme.colors.accent
            : theme.colors.surfaceMuted,
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
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
