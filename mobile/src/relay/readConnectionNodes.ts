type ConnectionLike<TNode> = {
  readonly edges?:
    | ReadonlyArray<{ readonly node?: TNode | null } | null | undefined>
    | null;
} | null | undefined;

export function readConnectionNodes<TNode>(
  connection?: ConnectionLike<TNode>,
): Array<NonNullable<TNode>> {
  return (
    connection?.edges
      ?.map((edge) => edge?.node)
      .filter((node): node is NonNullable<TNode> => node != null) ?? []
  );
}
