import { StyleSheet, Text, View } from 'react-native';

export default function LiveSessionModal() {
  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>Modal entry</Text>
      <Text style={styles.title}>Live session</Text>
      <Text style={styles.body}>
        This modal route will host future live-session entry points.
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
    backgroundColor: '#ffffff',
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
