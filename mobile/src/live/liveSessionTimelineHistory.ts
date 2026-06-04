export type LiveSessionTimelineHistoryActor = {
  readonly id: string;
};

export type LiveSessionTimelineHistoryPageInfo = {
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
  readonly startCursor: string | null;
};

export type LiveSessionTimelineEventBaseNode = {
  readonly __typename: string;
  readonly actor: LiveSessionTimelineHistoryActor | null;
  readonly eventType: string;
  readonly id: string;
  readonly occurredAt: string;
};

export type LiveSessionTimelineChatMessageEventNode =
  LiveSessionTimelineEventBaseNode & {
    readonly __typename: 'ChatMessageEvent';
    readonly body: string;
    readonly edited: boolean;
    readonly editCount: number;
    readonly editedAt: string | null;
  };

export type LiveSessionTimelineLifecycleEventNode =
  LiveSessionTimelineEventBaseNode & {
    readonly __typename:
      | 'LiveSessionEndedEvent'
      | 'LiveSessionStartedEvent';
  };

export type LiveSessionTimelineFutureEventNode =
  LiveSessionTimelineEventBaseNode & {
    readonly __typename: string;
  };

export type LiveSessionTimelineEventNode =
  | LiveSessionTimelineChatMessageEventNode
  | LiveSessionTimelineFutureEventNode
  | LiveSessionTimelineLifecycleEventNode;

type LiveSessionTimelineHistoryEdge = {
  readonly cursor?: string | null;
  readonly node?: LiveSessionTimelineEventNode | null;
};

export type LiveSessionTimelineHistoryConnection = {
  readonly edges?:
    | ReadonlyArray<LiveSessionTimelineHistoryEdge | null | undefined>
    | null;
  readonly pageInfo?: LiveSessionTimelineHistoryPageInfo | null;
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
    pageInfo: connection?.pageInfo ?? null,
    rows:
      connection?.edges
        ?.map((edge) => normalizeTimelineHistoryRow(edge))
        .filter(
          (row): row is LiveSessionTimelineHistoryRow => row != null,
        ) ?? [],
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
    actor: node.actor,
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
