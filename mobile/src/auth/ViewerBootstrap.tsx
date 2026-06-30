import React, {
  Suspense,
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  type PropsWithChildren,
} from 'react';
import { usePathname } from 'expo-router';
import { graphql, useLazyLoadQuery } from 'react-relay';

import { ScreenState } from '../components/ScreenState';
import { useAuth } from './AuthProvider';
import type { AuthTokenPair } from './types';
import type { ViewerBootstrapQuery } from '../__generated__/ViewerBootstrapQuery.graphql';

type ViewerBootstrapViewer = NonNullable<ViewerBootstrapQuery['response']['viewer']>;
type ResolvedViewerBootstrap = {
  tokens: AuthTokenPair;
  viewer: ViewerBootstrapViewer;
};

const ViewerContext = createContext<ViewerBootstrapViewer | null>(null);
const VIEWER_BOOTSTRAP_BYPASS_PATHNAMES = new Set(['/diagnostics']);

export function useViewer(): ViewerBootstrapViewer {
  const viewer = useContext(ViewerContext);

  if (!viewer) {
    throw new Error('useViewer must be used after ViewerBootstrap resolves');
  }

  return viewer;
}

export function ViewerBootstrap({ children }: PropsWithChildren) {
  const { state } = useAuth();
  const pathname = usePathname();
  const [queryRetryKey, retryViewerBootstrap] = useReducer(
    (key: number) => key + 1,
    0,
  );
  const [resolvedBootstrap, setResolvedBootstrap] =
    useState<ResolvedViewerBootstrap | null>(null);

  if (state.status !== 'authenticated') {
    return children;
  }

  // Diagnostics must stay reachable when the viewer bootstrap query itself is failing.
  if (VIEWER_BOOTSTRAP_BYPASS_PATHNAMES.has(pathname)) {
    return children;
  }

  const resolvedViewer =
    resolvedBootstrap?.tokens === state.tokens ? resolvedBootstrap.viewer : null;

  if (resolvedViewer) {
    return (
      <ViewerContext.Provider value={resolvedViewer}>
        {children}
      </ViewerContext.Provider>
    );
  }

  return (
    <ViewerBootstrapErrorBoundary
      key={queryRetryKey}
      onRetry={retryViewerBootstrap}
    >
      <Suspense
        fallback={
          <ScreenState state="loading" message="Restoring your session..." />
        }
      >
        <ViewerBootstrapQueryLoader
          key={queryRetryKey}
          onResolved={(viewer) =>
            setResolvedBootstrap({ tokens: state.tokens, viewer })
          }
        />
      </Suspense>
    </ViewerBootstrapErrorBoundary>
  );
}

type ViewerBootstrapErrorBoundaryProps = PropsWithChildren<{
  onRetry: () => void;
}>;

type ViewerBootstrapErrorBoundaryState = {
  hasError: boolean;
};

// Relay query errors are thrown during render; Suspense only handles pending loads.
class ViewerBootstrapErrorBoundary extends React.Component<
  ViewerBootstrapErrorBoundaryProps,
  ViewerBootstrapErrorBoundaryState
> {
  state: ViewerBootstrapErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ViewerBootstrapErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ScreenState
          state="error"
          message="We couldn't restore your session. Check your connection and try again."
          onRetry={this.props.onRetry}
        />
      );
    }

    return this.props.children;
  }
}

function ViewerBootstrapQueryLoader({
  onResolved,
}: {
  onResolved: (viewer: ViewerBootstrapViewer) => void;
}) {
  const { signOut } = useAuth();
  const data = useLazyLoadQuery<ViewerBootstrapQuery>(
    graphql`
      query ViewerBootstrapQuery {
        viewer {
          id
          email
          privacyMode
          insertedAt
        }
      }
    `,
    {},
    { fetchPolicy: 'network-only' },
  );
  const viewer = data.viewer;

  useEffect(() => {
    if (!viewer) {
      signOut();
      return;
    }

    onResolved(viewer);
  }, [onResolved, signOut, viewer]);

  if (!viewer) {
    return <ScreenState state="loading" message="Resetting your session..." />;
  }

  return null;
}
