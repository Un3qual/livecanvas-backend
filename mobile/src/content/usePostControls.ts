import { useMemo } from 'react';

import type { ContentPostChanges } from './contentPostChanges';
import type { PostControlsState } from './postControlViewState';
import {
  usePostOwnerControls,
  type PostOwnerControlActions,
} from './usePostOwnerControls';
import {
  useReportPostControls,
  type ReportPostControlActions,
} from './useReportPostControls';

export type PostControlsActions = PostOwnerControlActions &
  ReportPostControlActions;

export type PostControls = {
  readonly actions: PostControlsActions;
  readonly changes: ContentPostChanges;
  readonly state: PostControlsState;
};

export function usePostControls({
  viewerId,
}: {
  readonly viewerId: string | null;
}): PostControls {
  const ownerControls = usePostOwnerControls();
  const reportControls = useReportPostControls({ viewerId });
  const actions = useMemo<PostControlsActions>(
    () => ({
      ...ownerControls.actions,
      ...reportControls.actions,
    }),
    [ownerControls.actions, reportControls.actions],
  );
  const state = useMemo<PostControlsState>(
    () => ({
      owner: ownerControls.state,
      report: reportControls.state,
    }),
    [ownerControls.state, reportControls.state],
  );

  return useMemo(
    () => ({ actions, changes: ownerControls.changes, state }),
    [actions, ownerControls.changes, state],
  );
}
