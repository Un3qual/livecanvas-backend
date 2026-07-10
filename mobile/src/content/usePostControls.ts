import { useLayoutEffect, useReducer, useRef, useState } from 'react';
import { useMutation } from 'react-relay';

import {
  postOwnerControlDeletePostMutation,
  postOwnerControlUpdatePostMutation,
  type PostOwnerControlDeletePostMutation,
  type PostOwnerControlUpdatePostMutation,
} from '../feed/postOwnerControlOperations';
import {
  buildDeletePostInput,
  buildPostOwnerEditState,
  buildUpdatePostInput,
  formatDeletePostMutationErrors,
  formatUpdatePostMutationErrors,
  getPostOwnerUpdateValidationMessage,
  selectPostOwnerEditVisibility,
  updatePostOwnerEditBody,
  type PostOwnerEditState,
} from '../feed/postOwnerControlsState';
import {
  DEFAULT_REPORT_POST_REASON,
  canSubmitPostReport,
  createReportPostState,
  formatReportPostMutationErrors,
  reportPostReducer,
  type ReportPostState,
} from '../feed/reportPostReducer';
import type { FeedPostCardInput } from '../feed/feedPresentation';
import type { ContentPostChanges } from './contentPostChanges';
import {
  contentSurfaceReportPostMutation,
  type ContentSurfaceReportPostMutation,
} from './contentSurfaceOperations';

export type ContentPost = FeedPostCardInput;

export type PostOwnerPendingAction =
  | {
      readonly kind: 'delete' | 'update';
      readonly postId: string;
    }
  | null;

export type PostControls = {
  readonly changes: ContentPostChanges<ContentPost>;
  readonly deleteConfirmationPostId: string | null;
  readonly editState: PostOwnerEditState | null;
  readonly editingPostId: string | null;
  readonly errorsByPostId: Readonly<Record<string, string>>;
  readonly pendingAction: PostOwnerPendingAction;
  readonly reportState: ReportPostState;
  readonly cancelDelete: () => void;
  readonly cancelEdit: () => void;
  readonly confirmDelete: (post: ContentPost) => void;
  readonly deletePost: (post: ContentPost) => void;
  readonly reportPost: (post: ContentPost) => void;
  readonly saveEdit: (post: ContentPost) => void;
  readonly selectEditVisibility: (
    visibility: 'FOLLOWERS' | 'PUBLIC',
  ) => void;
  readonly startEdit: (post: ContentPost) => void;
  readonly updateEditBody: (bodyText: string) => void;
};

export function usePostControls({
  viewerId,
}: {
  readonly viewerId: string | null;
}): PostControls {
  const isActiveControllerRef = useRef(true);
  const [reportState, dispatchReport] = useReducer(
    reportPostReducer,
    createReportPostState(),
  );
  const activeReportPostIdRef = useRef<string | null>(null);
  const [commitReportPost] = useMutation<ContentSurfaceReportPostMutation>(
    contentSurfaceReportPostMutation,
  );
  const [commitUpdatePost] = useMutation<PostOwnerControlUpdatePostMutation>(
    postOwnerControlUpdatePostMutation,
  );
  const [commitDeletePost] = useMutation<PostOwnerControlDeletePostMutation>(
    postOwnerControlDeletePostMutation,
  );
  const activeOwnerActionRef = useRef<PostOwnerPendingAction>(null);
  const [pendingAction, setPendingAction] =
    useState<PostOwnerPendingAction>(null);
  const [errorsByPostId, setErrorsByPostId] = useState<
    Readonly<Record<string, string>>
  >({});
  const [updatedPostsById, setUpdatedPostsById] = useState<
    Readonly<Record<string, ContentPost>>
  >({});
  const [deletedPostIds, setDeletedPostIds] = useState<
    Readonly<Record<string, true>>
  >({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editState, setEditState] = useState<PostOwnerEditState | null>(null);
  const [deleteConfirmationPostId, setDeleteConfirmationPostId] =
    useState<string | null>(null);

  useLayoutEffect(() => {
    isActiveControllerRef.current = true;

    return () => {
      isActiveControllerRef.current = false;
    };
  }, []);

  function reportPost(post: ContentPost) {
    if (
      viewerId == null ||
      post.author.id === viewerId ||
      activeReportPostIdRef.current !== null ||
      !canSubmitPostReport(reportState, post.id)
    ) {
      return;
    }

    activeReportPostIdRef.current = post.id;
    dispatchReport({ postId: post.id, type: 'start' });
    commitReportPost({
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

        activeReportPostIdRef.current = null;
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

        activeReportPostIdRef.current = null;
        dispatchReport({
          message: formatReportPostMutationErrors(null),
          postId: post.id,
          type: 'error',
        });
      },
    });
  }

  function startEdit(post: ContentPost) {
    if (activeOwnerActionRef.current !== null || pendingAction !== null) {
      return;
    }

    setDeleteConfirmationPostId(null);
    setEditingPostId(post.id);
    setEditState(
      buildPostOwnerEditState({
        bodyText: post.bodyText,
        visibility: post.visibility,
      }),
    );
    setErrorsByPostId((current) => omitError(current, post.id));
  }

  function cancelEdit() {
    if (activeOwnerActionRef.current !== null || pendingAction !== null) {
      return;
    }

    setEditingPostId(null);
    setEditState(null);
  }

  function updateEditBody(bodyText: string) {
    if (activeOwnerActionRef.current !== null) {
      return;
    }

    setEditState((current) =>
      current ? updatePostOwnerEditBody(current, bodyText) : current,
    );
  }

  function selectEditVisibility(visibility: 'FOLLOWERS' | 'PUBLIC') {
    if (activeOwnerActionRef.current !== null) {
      return;
    }

    setEditState((current) =>
      current ? selectPostOwnerEditVisibility(current, visibility) : current,
    );
  }

  function saveEdit(post: ContentPost) {
    if (
      activeOwnerActionRef.current !== null ||
      pendingAction !== null ||
      editingPostId !== post.id ||
      editState === null
    ) {
      return;
    }

    const validationMessage = getPostOwnerUpdateValidationMessage(editState);

    if (validationMessage) {
      setErrorsByPostId((current) => ({
        ...current,
        [post.id]: validationMessage,
      }));
      return;
    }

    const input = buildUpdatePostInput(post.id, editState);

    if (!input) {
      return;
    }

    const action = { kind: 'update', postId: post.id } as const;
    activeOwnerActionRef.current = action;
    setPendingAction(action);
    setErrorsByPostId((current) => omitError(current, post.id));

    commitUpdatePost({
      variables: { input },
      onCompleted: (payload) => {
        if (!isActiveControllerRef.current) {
          return;
        }

        activeOwnerActionRef.current = null;
        setPendingAction(null);
        const result = payload.updatePost;
        const updatedPost = result?.post;

        if (!updatedPost || result?.errors.length) {
          setErrorsByPostId((current) => ({
            ...current,
            [post.id]: formatUpdatePostMutationErrors(result?.errors),
          }));
          return;
        }

        setUpdatedPostsById((current) => ({
          ...current,
          [updatedPost.id]: updatedPost,
        }));
        setEditingPostId(null);
        setEditState(null);
        setErrorsByPostId((current) => omitError(current, post.id));
      },
      onError: () => {
        if (!isActiveControllerRef.current) {
          return;
        }

        activeOwnerActionRef.current = null;
        setPendingAction(null);
        setErrorsByPostId((current) => ({
          ...current,
          [post.id]: formatUpdatePostMutationErrors(null),
        }));
      },
    });
  }

  function deletePost(post: ContentPost) {
    if (activeOwnerActionRef.current !== null || pendingAction !== null) {
      return;
    }

    setEditingPostId(null);
    setEditState(null);
    setDeleteConfirmationPostId(post.id);
    setErrorsByPostId((current) => omitError(current, post.id));
  }

  function cancelDelete() {
    if (activeOwnerActionRef.current !== null || pendingAction !== null) {
      return;
    }

    setDeleteConfirmationPostId(null);
  }

  function confirmDelete(post: ContentPost) {
    if (
      activeOwnerActionRef.current !== null ||
      pendingAction !== null ||
      deleteConfirmationPostId !== post.id
    ) {
      return;
    }

    const action = { kind: 'delete', postId: post.id } as const;
    activeOwnerActionRef.current = action;
    setPendingAction(action);
    setErrorsByPostId((current) => omitError(current, post.id));

    commitDeletePost({
      variables: { input: buildDeletePostInput(post.id) },
      onCompleted: (payload) => {
        if (!isActiveControllerRef.current) {
          return;
        }

        activeOwnerActionRef.current = null;
        setPendingAction(null);
        const result = payload.deletePost;
        const deletedPostId = result?.deletedPostId;

        if (!deletedPostId || result?.errors.length) {
          setErrorsByPostId((current) => ({
            ...current,
            [post.id]: formatDeletePostMutationErrors(result?.errors),
          }));
          return;
        }

        setDeletedPostIds((current) => ({
          ...current,
          [deletedPostId]: true,
        }));
        setUpdatedPostsById((current) => omitUpdatedPost(current, post.id));
        setDeleteConfirmationPostId(null);
        setErrorsByPostId((current) => omitError(current, post.id));
      },
      onError: () => {
        if (!isActiveControllerRef.current) {
          return;
        }

        activeOwnerActionRef.current = null;
        setPendingAction(null);
        setErrorsByPostId((current) => ({
          ...current,
          [post.id]: formatDeletePostMutationErrors(null),
        }));
      },
    });
  }

  return {
    cancelDelete,
    cancelEdit,
    changes: { deletedPostIds, updatedPostsById },
    confirmDelete,
    deleteConfirmationPostId,
    deletePost,
    editingPostId,
    editState,
    errorsByPostId,
    pendingAction,
    reportPost,
    reportState,
    saveEdit,
    selectEditVisibility,
    startEdit,
    updateEditBody,
  };
}

function omitError(
  values: Readonly<Record<string, string>>,
  postId: string,
): Readonly<Record<string, string>> {
  if (!Object.hasOwn(values, postId)) {
    return values;
  }

  const { [postId]: _removed, ...rest } = values;
  return rest;
}

function omitUpdatedPost(
  values: Readonly<Record<string, ContentPost>>,
  postId: string,
): Readonly<Record<string, ContentPost>> {
  if (!Object.hasOwn(values, postId)) {
    return values;
  }

  const { [postId]: _removed, ...rest } = values;
  return rest;
}
