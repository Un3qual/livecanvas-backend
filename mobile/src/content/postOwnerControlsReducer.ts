import type { ContentPost } from './contentPostPresentation';
import type { ContentPostChanges } from './contentPostChanges';
import {
  buildPostOwnerEditState,
  selectPostOwnerEditVisibility,
  updatePostOwnerEditBody,
  type PostOwnerEditState,
} from './postOwnerControlsState';

export type PostOwnerPendingAction =
  | {
      readonly kind: 'delete' | 'update';
      readonly postId: string;
    }
  | null;

export type PostOwnerControlsState = {
  readonly deleteConfirmationPostId: string | null;
  readonly deletedPostIds: Readonly<Record<string, true>>;
  readonly editState: PostOwnerEditState | null;
  readonly editingPostId: string | null;
  readonly errorsByPostId: Readonly<Record<string, string>>;
  readonly pendingAction: PostOwnerPendingAction;
  readonly updatedPostsById: Readonly<Record<string, ContentPost>>;
};

export type PostOwnerControlsAction =
  | { readonly post: ContentPost; readonly type: 'start_edit' }
  | { readonly type: 'edit_cancelled' }
  | { readonly bodyText: string; readonly type: 'edit_body_changed' }
  | {
      readonly type: 'edit_visibility_selected';
      readonly visibility: 'FOLLOWERS' | 'PUBLIC';
    }
  | {
      readonly message: string;
      readonly postId: string;
      readonly type: 'validation_failed';
    }
  | { readonly postId: string; readonly type: 'update_started' }
  | { readonly post: ContentPost; readonly type: 'update_succeeded' }
  | {
      readonly message: string;
      readonly postId: string;
      readonly type: 'update_failed';
    }
  | { readonly postId: string; readonly type: 'delete_requested' }
  | { readonly type: 'delete_cancelled' }
  | { readonly postId: string; readonly type: 'delete_started' }
  | { readonly postId: string; readonly type: 'delete_succeeded' }
  | {
      readonly message: string;
      readonly postId: string;
      readonly type: 'delete_failed';
    };

export function createPostOwnerControlsState(): PostOwnerControlsState {
  return {
    deleteConfirmationPostId: null,
    deletedPostIds: {},
    editingPostId: null,
    editState: null,
    errorsByPostId: {},
    pendingAction: null,
    updatedPostsById: {},
  };
}

export function postOwnerControlsReducer(
  state: PostOwnerControlsState,
  action: PostOwnerControlsAction,
): PostOwnerControlsState {
  switch (action.type) {
    case 'start_edit':
      if (state.pendingAction !== null) {
        return state;
      }

      return {
        ...state,
        deleteConfirmationPostId: null,
        editingPostId: action.post.id,
        editState: buildPostOwnerEditState({
          bodyText: action.post.bodyText,
          visibility: action.post.visibility,
        }),
        errorsByPostId: omitPostId(state.errorsByPostId, action.post.id),
      };

    case 'edit_cancelled':
      return state.pendingAction === null
        ? { ...state, editingPostId: null, editState: null }
        : state;

    case 'edit_body_changed':
      return state.pendingAction === null && state.editState
        ? {
            ...state,
            editState: updatePostOwnerEditBody(
              state.editState,
              action.bodyText,
            ),
          }
        : state;

    case 'edit_visibility_selected':
      return state.pendingAction === null && state.editState
        ? {
            ...state,
            editState: selectPostOwnerEditVisibility(
              state.editState,
              action.visibility,
            ),
          }
        : state;

    case 'validation_failed':
      if (
        state.pendingAction !== null ||
        state.editingPostId !== action.postId
      ) {
        return state;
      }

      return {
        ...state,
        errorsByPostId: {
          ...state.errorsByPostId,
          [action.postId]: action.message,
        },
      };

    case 'update_started':
      if (
        state.pendingAction !== null ||
        state.editingPostId !== action.postId ||
        state.editState === null
      ) {
        return state;
      }

      return {
        ...state,
        errorsByPostId: omitPostId(state.errorsByPostId, action.postId),
        pendingAction: { kind: 'update', postId: action.postId },
      };

    case 'update_succeeded':
      if (!isPendingAction(state, 'update', action.post.id)) {
        return state;
      }

      return {
        ...state,
        editingPostId: null,
        editState: null,
        errorsByPostId: omitPostId(state.errorsByPostId, action.post.id),
        pendingAction: null,
        updatedPostsById: {
          ...state.updatedPostsById,
          [action.post.id]: action.post,
        },
      };

    case 'update_failed':
      return isPendingAction(state, 'update', action.postId)
        ? {
            ...state,
            errorsByPostId: {
              ...state.errorsByPostId,
              [action.postId]: action.message,
            },
            pendingAction: null,
          }
        : state;

    case 'delete_requested':
      if (state.pendingAction !== null) {
        return state;
      }

      return {
        ...state,
        deleteConfirmationPostId: action.postId,
        editingPostId: null,
        editState: null,
        errorsByPostId: omitPostId(state.errorsByPostId, action.postId),
      };

    case 'delete_cancelled':
      return state.pendingAction === null
        ? { ...state, deleteConfirmationPostId: null }
        : state;

    case 'delete_started':
      if (
        state.pendingAction !== null ||
        state.deleteConfirmationPostId !== action.postId
      ) {
        return state;
      }

      return {
        ...state,
        errorsByPostId: omitPostId(state.errorsByPostId, action.postId),
        pendingAction: { kind: 'delete', postId: action.postId },
      };

    case 'delete_succeeded':
      if (!isPendingAction(state, 'delete', action.postId)) {
        return state;
      }

      return {
        ...state,
        deleteConfirmationPostId: null,
        deletedPostIds: {
          ...state.deletedPostIds,
          [action.postId]: true,
        },
        errorsByPostId: omitPostId(state.errorsByPostId, action.postId),
        pendingAction: null,
        updatedPostsById: omitPostId(state.updatedPostsById, action.postId),
      };

    case 'delete_failed':
      return isPendingAction(state, 'delete', action.postId)
        ? {
            ...state,
            errorsByPostId: {
              ...state.errorsByPostId,
              [action.postId]: action.message,
            },
            pendingAction: null,
          }
        : state;

    default:
      return state;
  }
}

export function selectPostOwnerChanges(
  state: PostOwnerControlsState,
): ContentPostChanges<ContentPost> {
  return {
    deletedPostIds: state.deletedPostIds,
    updatedPostsById: state.updatedPostsById,
  };
}

function isPendingAction(
  state: PostOwnerControlsState,
  kind: NonNullable<PostOwnerPendingAction>['kind'],
  postId: string,
): boolean {
  return (
    state.pendingAction?.kind === kind &&
    state.pendingAction.postId === postId
  );
}

function omitPostId<Value>(
  values: Readonly<Record<string, Value>>,
  postId: string,
): Readonly<Record<string, Value>> {
  if (!Object.hasOwn(values, postId)) {
    return values;
  }

  const { [postId]: _removed, ...rest } = values;
  return rest;
}
