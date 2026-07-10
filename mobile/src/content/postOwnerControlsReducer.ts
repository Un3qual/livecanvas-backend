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
      return startPostOwnerEdit(state, action.post);

    case 'edit_cancelled':
      return cancelPostOwnerEdit(state);

    case 'edit_body_changed':
      return changePostOwnerEditBody(state, action.bodyText);

    case 'edit_visibility_selected':
      return selectPostOwnerVisibility(state, action.visibility);

    case 'validation_failed':
      return failPostOwnerValidation(state, action.postId, action.message);

    case 'update_started':
      return startPostOwnerUpdate(state, action.postId);

    case 'update_succeeded':
      return completePostOwnerUpdate(state, action.post);

    case 'update_failed':
      return failPostOwnerUpdate(state, action.postId, action.message);

    case 'delete_requested':
      return requestPostOwnerDelete(state, action.postId);

    case 'delete_cancelled':
      return cancelPostOwnerDelete(state);

    case 'delete_started':
      return startPostOwnerDelete(state, action.postId);

    case 'delete_succeeded':
      return completePostOwnerDelete(state, action.postId);

    case 'delete_failed':
      return failPostOwnerDelete(state, action.postId, action.message);

    default:
      return state;
  }
}

function startPostOwnerEdit(
  state: PostOwnerControlsState,
  post: ContentPost,
): PostOwnerControlsState {
  if (state.pendingAction !== null) {
    return state;
  }

  return {
    ...state,
    deleteConfirmationPostId: null,
    editingPostId: post.id,
    editState: buildPostOwnerEditState({
      bodyText: post.bodyText,
      visibility: post.visibility,
    }),
    errorsByPostId: omitPostId(state.errorsByPostId, post.id),
  };
}

function cancelPostOwnerEdit(
  state: PostOwnerControlsState,
): PostOwnerControlsState {
  return state.pendingAction === null
    ? { ...state, editingPostId: null, editState: null }
    : state;
}

function changePostOwnerEditBody(
  state: PostOwnerControlsState,
  bodyText: string,
): PostOwnerControlsState {
  return state.pendingAction === null && state.editState
    ? {
        ...state,
        editState: updatePostOwnerEditBody(state.editState, bodyText),
      }
    : state;
}

function selectPostOwnerVisibility(
  state: PostOwnerControlsState,
  visibility: 'FOLLOWERS' | 'PUBLIC',
): PostOwnerControlsState {
  return state.pendingAction === null && state.editState
    ? {
        ...state,
        editState: selectPostOwnerEditVisibility(state.editState, visibility),
      }
    : state;
}

function failPostOwnerValidation(
  state: PostOwnerControlsState,
  postId: string,
  message: string,
): PostOwnerControlsState {
  if (state.pendingAction !== null || state.editingPostId !== postId) {
    return state;
  }

  return {
    ...state,
    errorsByPostId: {
      ...state.errorsByPostId,
      [postId]: message,
    },
  };
}

function startPostOwnerUpdate(
  state: PostOwnerControlsState,
  postId: string,
): PostOwnerControlsState {
  if (
    state.pendingAction !== null ||
    state.editingPostId !== postId ||
    state.editState === null
  ) {
    return state;
  }

  return {
    ...state,
    errorsByPostId: omitPostId(state.errorsByPostId, postId),
    pendingAction: { kind: 'update', postId },
  };
}

function completePostOwnerUpdate(
  state: PostOwnerControlsState,
  post: ContentPost,
): PostOwnerControlsState {
  if (!isPendingAction(state, 'update', post.id)) {
    return state;
  }

  return {
    ...state,
    editingPostId: null,
    editState: null,
    errorsByPostId: omitPostId(state.errorsByPostId, post.id),
    pendingAction: null,
    updatedPostsById: {
      ...state.updatedPostsById,
      [post.id]: post,
    },
  };
}

function failPostOwnerUpdate(
  state: PostOwnerControlsState,
  postId: string,
  message: string,
): PostOwnerControlsState {
  return isPendingAction(state, 'update', postId)
    ? {
        ...state,
        errorsByPostId: {
          ...state.errorsByPostId,
          [postId]: message,
        },
        pendingAction: null,
      }
    : state;
}

function requestPostOwnerDelete(
  state: PostOwnerControlsState,
  postId: string,
): PostOwnerControlsState {
  if (state.pendingAction !== null) {
    return state;
  }

  return {
    ...state,
    deleteConfirmationPostId: postId,
    editingPostId: null,
    editState: null,
    errorsByPostId: omitPostId(state.errorsByPostId, postId),
  };
}

function cancelPostOwnerDelete(
  state: PostOwnerControlsState,
): PostOwnerControlsState {
  return state.pendingAction === null
    ? { ...state, deleteConfirmationPostId: null }
    : state;
}

function startPostOwnerDelete(
  state: PostOwnerControlsState,
  postId: string,
): PostOwnerControlsState {
  if (
    state.pendingAction !== null ||
    state.deleteConfirmationPostId !== postId
  ) {
    return state;
  }

  return {
    ...state,
    errorsByPostId: omitPostId(state.errorsByPostId, postId),
    pendingAction: { kind: 'delete', postId },
  };
}

function completePostOwnerDelete(
  state: PostOwnerControlsState,
  postId: string,
): PostOwnerControlsState {
  if (!isPendingAction(state, 'delete', postId)) {
    return state;
  }

  return {
    ...state,
    deleteConfirmationPostId: null,
    deletedPostIds: {
      ...state.deletedPostIds,
      [postId]: true,
    },
    errorsByPostId: omitPostId(state.errorsByPostId, postId),
    pendingAction: null,
    updatedPostsById: omitPostId(state.updatedPostsById, postId),
  };
}

function failPostOwnerDelete(
  state: PostOwnerControlsState,
  postId: string,
  message: string,
): PostOwnerControlsState {
  return isPendingAction(state, 'delete', postId)
    ? {
        ...state,
        errorsByPostId: {
          ...state.errorsByPostId,
          [postId]: message,
        },
        pendingAction: null,
      }
    : state;
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
