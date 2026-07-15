export function profileHref(
  profileId: string,
  viewerId: string | null,
) {
  if (viewerId === profileId) {
    return { pathname: '/profile' as const };
  }

  return {
    params: { id: profileId },
    pathname: '/profiles/[id]' as const,
  };
}
