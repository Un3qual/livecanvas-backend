import { StyleSheet, View } from 'react-native';

import { AppCard } from '../../src/components/AppCard';
import { AppHeader } from '../../src/components/AppHeader';
import { useAppTheme } from '../../src/providers/ThemeProvider';
import { spacing } from '../../src/theme/tokens';

export default function LiveSessionModal() {
  const theme = useAppTheme();

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.surface }]}>
      <AppCard>
        <AppHeader
          eyebrow="Modal entry"
          title="Live session"
          subtitle="This modal route will host future live-session entry points."
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
