import type { RelationshipState } from '../relationshipPresentation';

export type RelationshipStateOverride = {
  readonly profileId: string;
  readonly state: RelationshipState;
};

export function otherUserProfileScreenResetKey(
  profileId: string,
  queryRetryKey: number,
): string {
  return `${profileId}:${queryRetryKey}`;
}

export function selectActiveRelationshipStateOverride(
  override: RelationshipStateOverride | null,
  profileId: string,
): RelationshipState | null {
  return override?.profileId === profileId ? override.state : null;
}
