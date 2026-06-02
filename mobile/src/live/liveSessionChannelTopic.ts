import {
  canEnterLiveSession,
  normalizeLiveSessionStatus,
} from './liveSessionPresentation';

export type LiveSessionChannelTopicSource = {
  readonly channelTopic?: string | null;
  readonly status: string;
};

export function readJoinableLiveSessionChannelTopic(
  source: LiveSessionChannelTopicSource,
): string | null {
  const topic = source.channelTopic?.trim();

  if (!topic || !canEnterLiveSession(normalizeLiveSessionStatus(source.status))) {
    return null;
  }

  return topic;
}
