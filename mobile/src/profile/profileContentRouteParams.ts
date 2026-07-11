import {
  PROFILE_CONTENT_KINDS,
  type ProfileContentKind,
} from '../content/contentSurfaceTypes';

export type ProfileContentScope = 'other' | 'viewer';

export function readProfileContentKindParam(
  value?: string | string[],
): ProfileContentKind | null {
  if (Array.isArray(value)) {
    return value.length === 1
      ? readProfileContentKindParam(value[0])
      : null;
  }

  const kind = value?.trim();

  return PROFILE_CONTENT_KINDS.find((candidate) => candidate === kind) ?? null;
}

export function profileContentHref(
  profileId: string,
  kind: ProfileContentKind,
  scope: ProfileContentScope,
) {
  return {
    params: { id: profileId, kind },
    pathname:
      scope === 'viewer'
        ? ('/profile/content' as const)
        : ('/profiles/[id]/content' as const),
  };
}
