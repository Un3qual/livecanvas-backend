import type { LiveSessionWatchScreenQuery } from './liveSessionWatchOperations';

export type LiveSessionWatchData = LiveSessionWatchScreenQuery['response'];

export type LiveSessionWatchModel = Extract<
  NonNullable<LiveSessionWatchData['node']>,
  { readonly __typename: 'LiveSession' }
>;

export function readLiveSessionWatchModel(
  data: LiveSessionWatchData,
): LiveSessionWatchModel | null {
  return data.node?.__typename === 'LiveSession' ? data.node : null;
}

export function readLiveSessionWatchViewerId(
  data: LiveSessionWatchData,
): string | null {
  return data.viewer?.id ?? null;
}
