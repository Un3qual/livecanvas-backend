import React, {
  Suspense,
  createContext,
  useContext,
  useEffect,
  useReducer,
  type PropsWithChildren,
} from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';

import { ScreenState } from '../components/ScreenState';
import { useAuth } from './AuthProvider';
import type { ViewerBootstrapQuery } from './__generated__/ViewerBootstrapQuery.graphql';

type ViewerBootstrapViewer = NonNullable<ViewerBootstrapQuery['response']['viewer']>;

const ViewerContext = createContext<ViewerBootstrapViewer | null>(null);

export function useViewer(): ViewerBootstrapViewer {
  const viewer = useContext(ViewerContext);

  if (!viewer) {
    throw new Error('useViewer must be used after ViewerBootstrap resolves');
  }

  return viewer;
}

export function ViewerBootstrap({ children }: PropsWithChildren) {
  const { state } = useAuth();
  const [queryRetryKey, retryViewerBootstrap] = useReducer(
    (key: number) => key + 1,
    0,
  );

  if (state.status !== 'authenticated') {
    return <>{children}</>;
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
        <ViewerBootstrapQueryLoader key={queryRetryKey}>
          {children}
        </ViewerBootstrapQueryLoader>
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

function ViewerBootstrapQueryLoader({ children }: PropsWithChildren) {
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
      void signOut();
    }
  }, [signOut, viewer]);

  if (!viewer) {
    return <ScreenState state="loading" message="Resetting your session..." />;
  }

  return (
    <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>
  );
}
