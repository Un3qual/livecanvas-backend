import type { ContentPost } from './contentPostPresentation';
import type { ContentPostUpdate } from './contentPostChanges';
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
  readonly updatedPostsById: Readonly<Record<string, ContentPostUpdate>>;
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
  | {
      readonly postId: string;
      readonly type: 'update_succeeded';
      readonly update: ContentPostUpdate;
    }
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

type PostOwnerEditAction = Extract<
  PostOwnerControlsAction,
  {
    readonly type:
      | 'edit_body_changed'
      | 'edit_cancelled'
      | 'edit_visibility_selected'
      | 'start_edit'
      | 'validation_failed';
  }
>;

type PostOwnerUpdateAction = Extract<
  PostOwnerControlsAction,
  {
    readonly type: 'update_failed' | 'update_started' | 'update_succeeded';
  }
>;

type PostOwnerDeleteAction = Extract<
  PostOwnerControlsAction,
  {
    readonly type:
      | 'delete_cancelled'
      | 'delete_failed'
      | 'delete_requested'
      | 'delete_started'
      | 'delete_succeeded';
  }
>;

export function postOwnerControlsReducer(
  state: PostOwnerControlsState,
  action: PostOwnerControlsAction,
): PostOwnerControlsState {
  switch (action.type) {
    case 'start_edit':
    case 'edit_cancelled':
    case 'edit_body_changed':
    case 'edit_visibility_selected':
    case 'validation_failed':
      return reducePostOwnerEdit(state, action);

    case 'update_started':
    case 'update_succeeded':
    case 'update_failed':
      return reducePostOwnerUpdate(state, action);

    case 'delete_requested':
    case 'delete_cancelled':
    case 'delete_started':
    case 'delete_succeeded':
    case 'delete_failed':
      return reducePostOwnerDelete(state, action);
  }
}

function reducePostOwnerEdit(
  state: PostOwnerControlsState,
  action: PostOwnerEditAction,
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
  }
}

function reducePostOwnerUpdate(
  state: PostOwnerControlsState,
  action: PostOwnerUpdateAction,
): PostOwnerControlsState {
  switch (action.type) {
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
      if (!isPendingAction(state, 'update', action.postId)) {
        return state;
      }

      return {
        ...state,
        editingPostId: null,
        editState: null,
        errorsByPostId: omitPostId(state.errorsByPostId, action.postId),
        pendingAction: null,
        updatedPostsById: {
          ...state.updatedPostsById,
          [action.postId]: action.update,
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
  }
}

function reducePostOwnerDelete(
  state: PostOwnerControlsState,
  action: PostOwnerDeleteAction,
): PostOwnerControlsState {
  switch (action.type) {
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
        updatedPostsById: omitPostId(
          state.updatedPostsById,
          action.postId,
        ),
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
  }
}

function isPendingAction(
  state: PostOwnerControlsState,
  kind: NonNullable<PostOwnerPendingAction>['kind'],
  postId: string,
): boolean {
  // Match the operation and post so stale async completions cannot mutate newer state.
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
