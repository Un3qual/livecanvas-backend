export function storyHref(storyId: string) {
  return {
    pathname: '/stories/[id]' as const,
    params: { id: storyId },
  };
}

export function readStoryIdParam(
  value?: string | string[],
): string | null {
  if (Array.isArray(value)) {
    // Reject ambiguous duplicate parameters; exactly one story ID is valid.
    return value.length === 1 ? readStoryIdParam(value[0]) : null;
  }

  const storyId = value?.trim();
  return storyId ? storyId : null;
}
