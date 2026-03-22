import { useRouter } from 'expo-router';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { AppEnvironment } from '../config/environment';
import {
  bootstrapRuntime,
  settleForcedLogoutSnapshot,
  type StartupSnapshot,
} from '../config/runtime';
import { useAppTheme } from './ThemeProvider';

type StartupTransition = { href: '/sign-in'; reason: 'forced_logout' };

type StartupState =
  | { status: 'booting' }
  | {
      status: 'ready';
      snapshot: StartupSnapshot;
      transition: StartupTransition | null;
    };

type StartupContextValue = {
  environment: AppEnvironment;
  snapshot: StartupSnapshot;
};

const StartupContext = createContext<StartupContextValue | null>(null);

export function StartupGate({
  children,
  environment,
}: PropsWithChildren<{ environment: AppEnvironment }>) {
  const router = useRouter();
  const [state, setState] = useState<StartupState>({ status: 'booting' });

  useEffect(() => {
    let isActive = true;

    void bootstrapRuntime(environment).then((snapshot) => {
      if (!isActive) {
        return;
      }

      setState({
        status: 'ready',
        snapshot,
        transition:
          snapshot.bootSessionState === 'forced_logout'
            ? { href: '/sign-in', reason: 'forced_logout' }
            : null,
      });
    });

    return () => {
      isActive = false;
    };
  }, [environment]);

  const transition = state.status === 'ready' ? state.transition : null;

  useEffect(() => {
    if (!transition) {
      return;
    }

    router.replace(transition.href);

    const timer = setTimeout(() => {
      setState((currentState) => {
        if (currentState.status !== 'ready' || !currentState.transition) {
          return currentState;
        }

        return {
          status: 'ready',
          snapshot:
            currentState.transition.reason === 'forced_logout'
              ? settleForcedLogoutSnapshot(currentState.snapshot)
              : currentState.snapshot,
          transition: null,
        };
      });
    }, 160);

    return () => {
      clearTimeout(timer);
    };
  }, [router, transition]);

  if (state.status === 'booting') {
    return (
      <StartupScreen
        eyebrow="Startup gate"
        title="Preparing LiveCanvas"
        body="Hydrating the local session placeholder and holding the route tree until the shell is ready."
      />
    );
  }

  return (
    <StartupContext.Provider
      value={{ environment, snapshot: state.snapshot }}
    >
      {children}
      {state.transition ? (
        <StartupScreen
          eyebrow="Session reset"
          title="Clearing the local shell"
          body="The navigator is mounted now, so the forced logout can safely route back through sign-in."
          overlay
        />
      ) : null}
    </StartupContext.Provider>
  );
}

function StartupScreen({
  eyebrow,
  title,
  body,
  overlay = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  overlay?: boolean;
}) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.screen,
        overlay ? styles.overlay : null,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <View
        style={[
          styles.panel,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>
          {eyebrow}
        </Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.body, { color: theme.colors.textMuted }]}>
          {body}
        </Text>
        <View
          style={[
            styles.indicatorRow,
            { backgroundColor: theme.colors.surfaceMuted },
          ]}
        >
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={[styles.indicatorLabel, { color: theme.colors.text }]}>
            Routing through the startup boundary
          </Text>
        </View>
      </View>
    </View>
  );
}

export function useStartupState(): StartupContextValue {
  const context = useContext(StartupContext);

  if (!context) {
    throw new Error('useStartupState must be used inside StartupGate');
  }

  return context;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    gap: 12,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  indicatorRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  indicatorLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
