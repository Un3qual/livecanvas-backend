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
    return value.length === 1 ? readStoryIdParam(value[0]) : null;
  }

  const storyId = value?.trim();
  return storyId ? storyId : null;
}
