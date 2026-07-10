import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { useMutation } from 'react-relay';

import type { ContentPost } from './contentPostPresentation';
import type { ContentPostChanges } from './contentPostChanges';
import {
  postOwnerControlDeletePostMutation,
  postOwnerControlUpdatePostMutation,
  type PostOwnerControlDeletePostMutation,
  type PostOwnerControlUpdatePostMutation,
} from './postOwnerControlOperations';
import {
  postOwnerControlsReducer,
  createPostOwnerControlsState,
  type PostOwnerControlsAction,
  type PostOwnerPendingAction,
  type PostOwnerControlsState,
} from './postOwnerControlsReducer';
import {
  buildDeletePostInput,
  buildUpdatePostInput,
  formatDeletePostMutationErrors,
  formatUpdatePostMutationErrors,
  getPostOwnerUpdateValidationMessage,
} from './postOwnerControlsState';

export type PostOwnerControlActions = {
  readonly cancelDelete: () => void;
  readonly cancelEdit: () => void;
  readonly confirmDelete: (post: ContentPost) => void;
  readonly deletePost: (post: ContentPost) => void;
  readonly saveEdit: (post: ContentPost) => void;
  readonly selectEditVisibility: (
    visibility: 'FOLLOWERS' | 'PUBLIC',
  ) => void;
  readonly startEdit: (post: ContentPost) => void;
  readonly updateEditBody: (bodyText: string) => void;
};

export type PostOwnerControls = {
  readonly actions: PostOwnerControlActions;
  readonly changes: ContentPostChanges;
  readonly state: PostOwnerControlsState;
};

export function usePostOwnerControls(): PostOwnerControls {
  const isActiveControllerRef = useRef(true);
  const [state, dispatch] = useReducer(
    postOwnerControlsReducer,
    undefined,
    createPostOwnerControlsState,
  );
  const stateRef = useRef(state);
  const activeOwnerActionRef = useRef<PostOwnerPendingAction>(null);
  const [commitUpdatePost] = useMutation<PostOwnerControlUpdatePostMutation>(
    postOwnerControlUpdatePostMutation,
  );
  const [commitDeletePost] = useMutation<PostOwnerControlDeletePostMutation>(
    postOwnerControlDeletePostMutation,
  );
  const commitUpdatePostRef = useRef(commitUpdatePost);
  const commitDeletePostRef = useRef(commitDeletePost);
  commitUpdatePostRef.current = commitUpdatePost;
  commitDeletePostRef.current = commitDeletePost;

  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  useLayoutEffect(() => {
    isActiveControllerRef.current = true;

    return () => {
      isActiveControllerRef.current = false;
      activeOwnerActionRef.current = null;
    };
  }, []);

  const dispatchOwner = useCallback((action: PostOwnerControlsAction) => {
    dispatch(action);
  }, []);

  const startEdit = useCallback(
    (post: ContentPost) => {
      dispatchOwner({ post, type: 'start_edit' });
    },
    [dispatchOwner],
  );

  const cancelEdit = useCallback(() => {
    dispatchOwner({ type: 'edit_cancelled' });
  }, [dispatchOwner]);

  const updateEditBody = useCallback(
    (bodyText: string) => {
      dispatchOwner({ bodyText, type: 'edit_body_changed' });
    },
    [dispatchOwner],
  );

  const selectEditVisibility = useCallback(
    (visibility: 'FOLLOWERS' | 'PUBLIC') => {
      dispatchOwner({ type: 'edit_visibility_selected', visibility });
    },
    [dispatchOwner],
  );

  const saveEdit = useCallback(
    (post: ContentPost) => {
      const current = stateRef.current;

      if (
        current.pendingAction !== null ||
        activeOwnerActionRef.current !== null ||
        current.editingPostId !== post.id ||
        current.editState === null
      ) {
        return;
      }

      const validationMessage = getPostOwnerUpdateValidationMessage(
        current.editState,
      );

      if (validationMessage) {
        dispatchOwner({
          message: validationMessage,
          postId: post.id,
          type: 'validation_failed',
        });
        return;
      }

      const input = buildUpdatePostInput(post.id, current.editState);

      if (!input) {
        return;
      }

      dispatchOwner({ postId: post.id, type: 'update_started' });
      activeOwnerActionRef.current = { kind: 'update', postId: post.id };

      commitUpdatePostRef.current({
        variables: { input },
        onCompleted: (payload) => {
          if (!isActiveControllerRef.current) {
            return;
          }

          if (
            activeOwnerActionRef.current?.kind !== 'update' ||
            activeOwnerActionRef.current.postId !== post.id
          ) {
            return;
          }

          activeOwnerActionRef.current = null;

          const result = payload.updatePost;
          const updatedPost = result?.post;

          if (!updatedPost || result?.errors.length) {
            dispatchOwner({
              message: formatUpdatePostMutationErrors(result?.errors),
              postId: post.id,
              type: 'update_failed',
            });
            return;
          }

          dispatchOwner({ postId: updatedPost.id, type: 'update_succeeded' });
        },
        onError: () => {
          if (!isActiveControllerRef.current) {
            return;
          }


          activeOwnerActionRef.current = null;

          dispatchOwner({
            message: formatUpdatePostMutationErrors(null),
            postId: post.id,
            type: 'update_failed',
          });
        },
      });
    },
    [dispatchOwner],
  );

  const deletePost = useCallback(
    (post: ContentPost) => {
      dispatchOwner({ postId: post.id, type: 'delete_requested' });
    },
    [dispatchOwner],
  );

  const cancelDelete = useCallback(() => {
    dispatchOwner({ type: 'delete_cancelled' });
  }, [dispatchOwner]);

  const confirmDelete = useCallback(
    (post: ContentPost) => {
      const current = stateRef.current;

      if (
        current.pendingAction !== null ||
        activeOwnerActionRef.current !== null ||
        current.deleteConfirmationPostId !== post.id
      ) {
        return;
      }

      dispatchOwner({ postId: post.id, type: 'delete_started' });
      activeOwnerActionRef.current = { kind: 'delete', postId: post.id };

      commitDeletePostRef.current({
        variables: { input: buildDeletePostInput(post.id) },
        onCompleted: (payload) => {
          if (!isActiveControllerRef.current) {
            return;
          }

          if (
            activeOwnerActionRef.current?.kind !== 'delete' ||
            activeOwnerActionRef.current.postId !== post.id
          ) {
            return;
          }

          activeOwnerActionRef.current = null;

          const result = payload.deletePost;
          const deletedPostId = result?.deletedPostId;

          if (!deletedPostId || result?.errors.length) {
            dispatchOwner({
              message: formatDeletePostMutationErrors(result?.errors),
              postId: post.id,
              type: 'delete_failed',
            });
            return;
          }

          dispatchOwner({
            postId: deletedPostId,
            type: 'delete_succeeded',
          });
        },
        onError: () => {
          if (!isActiveControllerRef.current) {
            return;
          }

          activeOwnerActionRef.current = null;

          dispatchOwner({
            message: formatDeletePostMutationErrors(null),
            postId: post.id,
            type: 'delete_failed',
          });
        },
      });
    },
    [dispatchOwner],
  );

  const actions = useMemo<PostOwnerControlActions>(
    () => ({
      cancelDelete,
      cancelEdit,
      confirmDelete,
      deletePost,
      saveEdit,
      selectEditVisibility,
      startEdit,
      updateEditBody,
    }),
    [
      cancelDelete,
      cancelEdit,
      confirmDelete,
      deletePost,
      saveEdit,
      selectEditVisibility,
      startEdit,
      updateEditBody,
    ],
  );
  const changes = useMemo<ContentPostChanges>(
    () => ({
      deletedPostIds: state.deletedPostIds,
    }),
    [state.deletedPostIds],
  );

  return useMemo(
    () => ({ actions, changes, state }),
    [actions, changes, state],
  );
}
