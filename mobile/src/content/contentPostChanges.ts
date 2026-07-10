export type ContentPostChanges<Post extends { readonly id: string }> = {
  readonly deletedPostIds: Readonly<Record<string, true>>;
  readonly updatedPostsById: Readonly<Record<string, Post>>;
};

export function applyContentPostChanges<Post extends { readonly id: string }>(
  posts: ReadonlyArray<Post>,
  changes: ContentPostChanges<Post>,
): Post[] {
  return posts
    .filter((post) => changes.deletedPostIds[post.id] !== true)
    .map((post) => changes.updatedPostsById[post.id] ?? post);
}
