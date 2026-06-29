import { Text, View } from 'react-native';

import { useAppTheme } from '../../providers/ThemeProvider';
import { profileScreenStyles as styles } from './profileScreenStyles';

export function ProfileAvatar({ initials }: { initials: string }) {
  const theme = useAppTheme();

  return (
    <View
      style={[styles.avatar, { backgroundColor: theme.colors.surfaceMuted }]}
    >
      <Text style={[styles.avatarText, { color: theme.colors.accent }]}>
        {initials}
      </Text>
    </View>
  );
}

export function SmallProfileAvatar({ initials }: { initials: string }) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.smallAvatar,
        { backgroundColor: theme.colors.surfaceMuted },
      ]}
    >
      <Text style={[styles.smallAvatarText, { color: theme.colors.accent }]}>
        {initials}
      </Text>
    </View>
  );
}

