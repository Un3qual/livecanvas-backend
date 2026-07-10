import type { RelationshipState } from '../relationshipPresentation';

export type RelationshipViewOverride = {
  readonly isBlockedByViewer: boolean | null;
  readonly profileId: string;
  readonly state: RelationshipState | null;
};

export function otherUserProfileScreenResetKey(
  profileId: string,
  queryRetryKey: number,
): string {
  return `${profileId}:${queryRetryKey}`;
}

export function selectActiveRelationshipViewOverride(
  override: RelationshipViewOverride | null,
  profileId: string,
): RelationshipViewOverride | null {
  return override?.profileId === profileId ? override : null;
}
