import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../providers/ThemeProvider';
import { typography, spacing, radius } from '../theme/tokens';

import { AppButton } from './AppButton';

type LoadingState = { state: 'loading'; message?: string };
type ErrorState = { state: 'error'; message: string; onRetry?: () => void };
type EmptyState = { state: 'empty'; message: string };

type ScreenStateProps = LoadingState | ErrorState | EmptyState;

/**
 * Reusable loading / error / empty primitives for shell screens.
 * Designed to fill available space and center the feedback.
 */
export function ScreenState(props: ScreenStateProps) {
  const theme = useAppTheme();

  switch (props.state) {
    case 'loading':
      return (
        <View
          style={[styles.root, { backgroundColor: theme.colors.background }]}
        >
          <ActivityIndicator size="large" color={theme.colors.accent} />
          {props.message ? (
            <Text style={[styles.message, { color: theme.colors.textMuted }]}>
              {props.message}
            </Text>
          ) : null}
        </View>
      );

    case 'error':
      return (
        <View
          style={[styles.root, { backgroundColor: theme.colors.background }]}
        >
          <View
            style={[
              styles.badge,
              { backgroundColor: theme.colors.errorMuted },
            ]}
          >
            <Text style={[styles.badgeText, { color: theme.colors.error }]}>
              Error
            </Text>
          </View>
          <Text style={[styles.message, { color: theme.colors.text }]}>
            {props.message}
          </Text>
          {props.onRetry ? (
            <AppButton label="Retry" onPress={props.onRetry} />
          ) : null}
        </View>
      );

    case 'empty':
      return (
        <View
          style={[styles.root, { backgroundColor: theme.colors.background }]}
        >
          <Text style={[styles.message, { color: theme.colors.textMuted }]}>
            {props.message}
          </Text>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  message: {
    ...typography.body,
    maxWidth: 320,
    textAlign: 'center',
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  badgeText: {
    ...typography.label,
  },
});
