export type LiveSessionTimelineHistoryActor = {
  readonly id: string;
};

export type LiveSessionTimelineHistoryPageInfo = {
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
  readonly startCursor: string | null;
};

type LiveSessionTimelineHistoryConnectionPageInfo = {
  readonly endCursor?: string | null | undefined;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
  readonly startCursor?: string | null | undefined;
};

export type LiveSessionTimelineEventBaseNode<
  EventType extends string = string,
> = {
  readonly __typename: string;
  readonly actor?: LiveSessionTimelineHistoryActor | null | undefined;
  readonly eventType: EventType;
  readonly id: string;
  readonly occurredAt: string;
};

export type LiveSessionTimelineChatMessageEventNode<
  EventType extends string = string,
> = LiveSessionTimelineEventBaseNode<EventType> & {
    readonly __typename: 'ChatMessageEvent';
    readonly body: string;
    readonly edited: boolean;
    readonly editCount: number;
    readonly editedAt: string | null;
  };

export type LiveSessionTimelineLifecycleEventNode<
  EventType extends string = string,
> = LiveSessionTimelineEventBaseNode<EventType> & {
    readonly __typename:
      | 'LiveSessionEndedEvent'
      | 'LiveSessionStartedEvent';
  };

export type LiveSessionTimelineFutureEventNode<
  EventType extends string = string,
> = LiveSessionTimelineEventBaseNode<EventType> & {
    readonly body?: string | undefined;
    readonly editCount?: number | undefined;
    readonly edited?: boolean | undefined;
    readonly editedAt?: string | null | undefined;
  };

export type LiveSessionTimelineEventNode<
  EventType extends string = string,
> =
  | LiveSessionTimelineChatMessageEventNode<EventType>
  | LiveSessionTimelineFutureEventNode<EventType>
  | LiveSessionTimelineLifecycleEventNode<EventType>;

type LiveSessionTimelineHistoryEdge<EventType extends string = string> = {
  readonly cursor?: string | null;
  readonly node?: LiveSessionTimelineEventNode<EventType> | null;
};

export type LiveSessionTimelineHistoryConnection<
  EventType extends string = string,
> = {
  readonly edges?:
    | ReadonlyArray<LiveSessionTimelineHistoryEdge<EventType> | null | undefined>
    | null;
  readonly pageInfo?: LiveSessionTimelineHistoryConnectionPageInfo | null;
} | null | undefined;

type LiveSessionTimelineHistoryRowBase = {
  readonly __typename: string;
  readonly actor: LiveSessionTimelineHistoryActor | null;
  readonly cursor: string | null;
  readonly eventType: string;
  readonly id: string;
  readonly occurredAt: string;
};

export type LiveSessionTimelineChatMessageRow =
  LiveSessionTimelineHistoryRowBase & {
    readonly __typename: 'ChatMessageEvent';
    readonly body: string;
    readonly editCount: number;
    readonly edited: boolean;
    readonly editedAt: string | null;
    readonly kind: 'chat_message';
  };

export type LiveSessionTimelineLifecycleRow =
  LiveSessionTimelineHistoryRowBase & {
    readonly __typename:
      | 'LiveSessionEndedEvent'
      | 'LiveSessionStartedEvent';
    readonly kind: 'lifecycle';
    readonly label: 'Live ended' | 'Live started';
  };

export type LiveSessionTimelineUnknownRow =
  LiveSessionTimelineHistoryRowBase & {
    readonly kind: 'unknown';
    readonly label: 'Timeline event';
  };

export type LiveSessionTimelineHistoryRow =
  | LiveSessionTimelineChatMessageRow
  | LiveSessionTimelineLifecycleRow
  | LiveSessionTimelineUnknownRow;

export type LiveSessionTimelineHistory = {
  readonly pageInfo: LiveSessionTimelineHistoryPageInfo | null;
  readonly rows: ReadonlyArray<LiveSessionTimelineHistoryRow>;
};

export function readLiveSessionTimelineHistory(
  connection?: LiveSessionTimelineHistoryConnection,
): LiveSessionTimelineHistory {
  return {
    pageInfo: normalizeTimelineHistoryPageInfo(connection?.pageInfo),
    rows:
      connection?.edges
        ?.map((edge) => normalizeTimelineHistoryRow(edge))
        .filter(
          (row): row is LiveSessionTimelineHistoryRow => row != null,
        ) ?? [],
  };
}

function normalizeTimelineHistoryPageInfo(
  pageInfo?: LiveSessionTimelineHistoryConnectionPageInfo | null,
): LiveSessionTimelineHistoryPageInfo | null {
  if (!pageInfo) {
    return null;
  }

  return {
    endCursor: pageInfo.endCursor ?? null,
    hasNextPage: pageInfo.hasNextPage,
    hasPreviousPage: pageInfo.hasPreviousPage,
    startCursor: pageInfo.startCursor ?? null,
  };
}

function normalizeTimelineHistoryRow(
  edge?: LiveSessionTimelineHistoryEdge | null,
): LiveSessionTimelineHistoryRow | null {
  const node = edge?.node;

  if (!node) {
    return null;
  }

  const base = {
    __typename: node.__typename,
    actor: node.actor ?? null,
    cursor: edge.cursor ?? null,
    eventType: node.eventType,
    id: node.id,
    occurredAt: node.occurredAt,
  };

  switch (node.__typename) {
    case 'ChatMessageEvent': {
      if (!isChatMessageEventNode(node)) {
        return null;
      }

      return {
        ...base,
        __typename: 'ChatMessageEvent',
        body: node.body,
        editCount: node.editCount,
        edited: node.edited,
        editedAt: node.editedAt,
        kind: 'chat_message',
      };
    }
    case 'LiveSessionEndedEvent':
      return {
        ...base,
        __typename: 'LiveSessionEndedEvent',
        kind: 'lifecycle',
        label: 'Live ended',
      };
    case 'LiveSessionStartedEvent':
      return {
        ...base,
        __typename: 'LiveSessionStartedEvent',
        kind: 'lifecycle',
        label: 'Live started',
      };
    default:
      return {
        ...base,
        kind: 'unknown',
        label: 'Timeline event',
      };
  }
}

function isChatMessageEventNode(
  node: LiveSessionTimelineEventNode,
): node is LiveSessionTimelineChatMessageEventNode {
  if (node.__typename !== 'ChatMessageEvent') {
    return false;
  }

  const chatNode = node as Partial<LiveSessionTimelineChatMessageEventNode>;

  return (
    typeof chatNode.body === 'string' &&
    typeof chatNode.editCount === 'number' &&
    typeof chatNode.edited === 'boolean' &&
    (chatNode.editedAt === null || typeof chatNode.editedAt === 'string')
  );
}
