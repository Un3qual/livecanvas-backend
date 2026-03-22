import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function SignInScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>Unauthenticated entry</Text>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.body}>
        This route group is the entry point for future auth flows.
      </Text>
      <Link href="/home" style={styles.link}>
        Continue to the app shell
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
  link: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
});
