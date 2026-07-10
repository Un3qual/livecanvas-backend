import type { PostOwnerEditState } from './postOwnerControlsState';
import type { PostOwnerControlsState } from './postOwnerControlsReducer';
import {
  isPostReportConfirmed,
  type ReportPostState,
} from './reportPostReducer';

export type PostControlsState = {
  readonly owner: PostOwnerControlsState;
  readonly report: ReportPostState;
};

export type PostControlViewState = {
  readonly editState: PostOwnerEditState | null;
  readonly isConfirmingDelete: boolean;
  readonly isDeleting: boolean;
  readonly isEditing: boolean;
  readonly isOwnerActionPending: boolean;
  readonly isReportActive: boolean;
  readonly isReportConfirmed: boolean;
  readonly isReportPending: boolean;
  readonly isUpdating: boolean;
  readonly ownerError: string | null;
  readonly reportError: string | null;
};

export function selectPostControlViewState(
  state: PostControlsState,
  postId: string,
): PostControlViewState {
  const ownerAction = state.owner.pendingAction;
  const isEditing = state.owner.editingPostId === postId;

  return {
    editState: isEditing ? state.owner.editState : null,
    isConfirmingDelete: state.owner.deleteConfirmationPostId === postId,
    isDeleting:
      ownerAction?.kind === 'delete' && ownerAction.postId === postId,
    isEditing,
    isOwnerActionPending: ownerAction !== null,
    isReportActive: state.report.activePostId === postId,
    isReportConfirmed: isPostReportConfirmed(state.report, postId),
    isReportPending: state.report.activePostId !== null,
    isUpdating:
      ownerAction?.kind === 'update' && ownerAction.postId === postId,
    ownerError: state.owner.errorsByPostId[postId] ?? null,
    reportError: state.report.errorsByPostId[postId] ?? null,
  };
}

export function arePostControlViewStatesEqual(
  previous: PostControlViewState,
  next: PostControlViewState,
): boolean {
  return (
    previous.editState === next.editState &&
    previous.isConfirmingDelete === next.isConfirmingDelete &&
    previous.isDeleting === next.isDeleting &&
    previous.isEditing === next.isEditing &&
    previous.isOwnerActionPending === next.isOwnerActionPending &&
    previous.isReportActive === next.isReportActive &&
    previous.isReportConfirmed === next.isReportConfirmed &&
    previous.isReportPending === next.isReportPending &&
    previous.isUpdating === next.isUpdating &&
    previous.ownerError === next.ownerError &&
    previous.reportError === next.reportError
  );
}
