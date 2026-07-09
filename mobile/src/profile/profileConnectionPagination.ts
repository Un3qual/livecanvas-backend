export type ProfileConnectionNode = {
  readonly id: string;
};

export type ProfileConnectionPageInfo = {
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
};

export function readProfileConnectionPageInfo(
  connection:
    | {
        readonly pageInfo?: {
          readonly endCursor?: string | null;
          readonly hasNextPage?: boolean;
        } | null;
      }
    | null
    | undefined,
): ProfileConnectionPageInfo {
  return {
    endCursor: connection?.pageInfo?.endCursor ?? null,
    hasNextPage: connection?.pageInfo?.hasNextPage ?? false,
  };
}

export function appendProfileConnectionNodes<Node extends ProfileConnectionNode>(
  current: ReadonlyArray<Node>,
  incoming: ReadonlyArray<Node>,
): Node[] {
  const seenIds = new Set(current.map((node) => node.id));
  const nextNodes = current.slice();

  for (const node of incoming) {
    if (seenIds.has(node.id)) {
      continue;
    }

    seenIds.add(node.id);
    nextNodes.push(node);
  }

  return nextNodes;
}
