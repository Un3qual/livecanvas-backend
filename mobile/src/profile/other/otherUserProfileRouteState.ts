export function otherUserProfileScreenResetKey(
  profileId: string,
  queryRetryKey: number,
): string {
  return `${profileId}:${queryRetryKey}`;
}
