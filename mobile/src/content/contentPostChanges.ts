export type ContentPostChanges = {
  readonly deletedPostIds: Readonly<Record<string, true>>;
};

export function applyContentPostChanges<Post extends { readonly id: string }>(
  posts: ReadonlyArray<Post>,
  changes: ContentPostChanges,
): Post[] {
  return posts.filter((post) => changes.deletedPostIds[post.id] !== true);
}
