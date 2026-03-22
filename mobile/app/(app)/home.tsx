import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>Authenticated shell</Text>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.body}>
        The app group will hold the durable signed-in experience.
      </Text>
      <Link href="/profile" style={styles.link}>
        Open profile
      </Link>
      <Link href="/live-session" style={styles.link}>
        Open live session modal
      </Link>
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
  link: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
});
