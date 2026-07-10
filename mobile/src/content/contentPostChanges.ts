type ContentPostEditableFields = {
  readonly bodyText?: string | null;
  readonly visibility: string | null | undefined;
};

export type ContentPostUpdate = {
  readonly from: ContentPostEditableFields;
  readonly to: ContentPostEditableFields;
};

export type ContentPostChanges = {
  readonly deletedPostIds: Readonly<Record<string, true>>;
  readonly updatedPostsById: Readonly<Record<string, ContentPostUpdate>>;
};

export function applyContentPostChanges<
  Post extends ContentPostEditableFields & { readonly id: string },
>(
  posts: ReadonlyArray<Post>,
  changes: ContentPostChanges,
): Post[] {
  return posts
    .filter((post) => changes.deletedPostIds[post.id] !== true)
    .map((post) => applyContentPostUpdate(post, changes.updatedPostsById));
}

function applyContentPostUpdate<
  Post extends ContentPostEditableFields & { readonly id: string },
>(
  post: Post,
  updatesByPostId: ContentPostChanges['updatedPostsById'],
): Post {
  const update = updatesByPostId[post.id];

  if (
    !update ||
    post.bodyText !== update.from.bodyText ||
    post.visibility !== update.from.visibility
  ) {
    // A changed Relay row is authoritative; local patches only repair retained snapshots.
    return post;
  }

  return { ...post, ...update.to };
}
