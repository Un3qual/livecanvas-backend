import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppHeader } from '../../src/components/AppHeader';
import { useAppTheme } from '../../src/providers/ThemeProvider';
import { spacing } from '../../src/theme/tokens';

export default function HomeScreen() {
  const theme = useAppTheme();
  const router = useRouter();

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <AppHeader
        eyebrow="Authenticated shell"
        title="Home"
        subtitle="The app group will hold the durable signed-in experience."
      />
      <View style={styles.actions}>
        <AppButton
          label="Open profile"
          onPress={() => router.push('/profile')}
        />
        <AppButton
          label="Open live session modal"
          variant="secondary"
          onPress={() => router.push('/live-session')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
    width: '100%',
    maxWidth: 320,
  },
});
