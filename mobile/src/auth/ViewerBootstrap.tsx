import React, {
  Suspense,
  createContext,
  useContext,
  useEffect,
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

  if (state.status !== 'authenticated') {
    return <>{children}</>;
  }

  return (
    <Suspense
      fallback={
        <ScreenState state="loading" message="Restoring your session..." />
      }
    >
      <ViewerBootstrapQueryLoader>{children}</ViewerBootstrapQueryLoader>
    </Suspense>
  );
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
