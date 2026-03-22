import { StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>Profile entry</Text>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.body}>
        This route will become the signed-in profile surface.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#f8fafc',
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },
  body: {
    maxWidth: 320,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
    color: '#374151',
  },
});
