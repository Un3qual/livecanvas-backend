import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { useMutation } from 'react-relay';

import type { ContentPost } from './contentPostPresentation';
import {
  contentSurfaceReportPostMutation,
  type ContentSurfaceReportPostMutation,
} from './contentSurfaceOperations';
import {
  DEFAULT_REPORT_POST_REASON,
  canSubmitPostReport,
  createReportPostState,
  formatReportPostMutationErrors,
  reportPostReducer,
  type ReportPostAction,
  type ReportPostState,
} from './reportPostReducer';

export type ReportPostControlActions = {
  readonly reportPost: (post: ContentPost) => void;
};

export type ReportPostControls = {
  readonly actions: ReportPostControlActions;
  readonly state: ReportPostState;
};

export function useReportPostControls({
  viewerId,
}: {
  readonly viewerId: string | null;
}): ReportPostControls {
  const isActiveControllerRef = useRef(true);
  const viewerIdRef = useRef(viewerId);
  viewerIdRef.current = viewerId;
  const [state, dispatch] = useReducer(
    reportPostReducer,
    undefined,
    createReportPostState,
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const [commitReportPost] = useMutation<ContentSurfaceReportPostMutation>(
    contentSurfaceReportPostMutation,
  );
  const commitReportPostRef = useRef(commitReportPost);
  commitReportPostRef.current = commitReportPost;

  useLayoutEffect(() => {
    isActiveControllerRef.current = true;

    return () => {
      isActiveControllerRef.current = false;
    };
  }, []);

  const dispatchReport = useCallback((action: ReportPostAction) => {
    stateRef.current = reportPostReducer(stateRef.current, action);
    dispatch(action);
  }, []);

  const reportPost = useCallback(
    (post: ContentPost) => {
      const current = stateRef.current;
      const currentViewerId = viewerIdRef.current;

      if (
        currentViewerId == null ||
        post.author.id === currentViewerId ||
        current.activePostId !== null ||
        !canSubmitPostReport(current, post.id)
      ) {
        return;
      }

      dispatchReport({ postId: post.id, type: 'start' });

      if (stateRef.current.activePostId !== post.id) {
        return;
      }

      commitReportPostRef.current({
        variables: {
          input: {
            details: null,
            postId: post.id,
            reason: DEFAULT_REPORT_POST_REASON,
          },
        },
        onCompleted: (payload) => {
          if (!isActiveControllerRef.current) {
            return;
          }

          const result = payload.reportPost;

          if (!result?.report || result.errors.length > 0) {
            dispatchReport({
              message: formatReportPostMutationErrors(result?.errors),
              postId: post.id,
              type: 'error',
            });
            return;
          }

          dispatchReport({ postId: post.id, type: 'success' });
        },
        onError: () => {
          if (!isActiveControllerRef.current) {
            return;
          }

          dispatchReport({
            message: formatReportPostMutationErrors(null),
            postId: post.id,
            type: 'error',
          });
        },
      });
    },
    [dispatchReport],
  );

  const actions = useMemo<ReportPostControlActions>(
    () => ({ reportPost }),
    [reportPost],
  );

  return useMemo(() => ({ actions, state }), [actions, state]);
}
