import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppHeader } from '../../src/components/AppHeader';
import { useAppTheme } from '../../src/providers/ThemeProvider';
import { spacing } from '../../src/theme/tokens';

export default function SignInScreen() {
  const theme = useAppTheme();
  const router = useRouter();

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.surface }]}>
      <AppCard>
        <AppHeader
          eyebrow="Unauthenticated entry"
          title="Sign in"
          subtitle="This route group is the entry point for future auth flows."
        />
        <View style={styles.actions}>
          <AppButton
            label="Continue to the app shell"
            onPress={() => router.push('/home')}
          />
        </View>
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  actions: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
});
