export const CONTENT_SURFACE_KINDS = [
  'posts',
  'stories',
  'live',
  'replays',
] as const;

export const PROFILE_CONTENT_KINDS = [
  'posts',
  'stories',
  'replays',
] as const;

export type ContentSurfaceKind = (typeof CONTENT_SURFACE_KINDS)[number];
export type ProfileContentKind = (typeof PROFILE_CONTENT_KINDS)[number];

export type ContentNode = {
  readonly id: string;
};

export type ContentPageInfo = {
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
};

export type ContentRequestIdentity = {
  readonly cursor: string;
  readonly key: string;
  readonly routeGeneration: number;
};
