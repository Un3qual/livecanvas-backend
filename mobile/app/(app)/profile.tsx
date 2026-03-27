import { StyleSheet, View } from 'react-native';

import { AppCard } from '../../src/components/AppCard';
import { AppHeader } from '../../src/components/AppHeader';
import { useAppTheme } from '../../src/providers/ThemeProvider';
import { spacing } from '../../src/theme/tokens';

export default function ProfileScreen() {
  const theme = useAppTheme();

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <AppCard>
        <AppHeader
          eyebrow="Profile entry"
          title="Profile"
          subtitle="This route will become the signed-in profile surface."
        />
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
});
