export type MutationError = {
  readonly field?: string | null;
  readonly message: string;
};

export function formatMutationErrors(
  errors: ReadonlyArray<MutationError> | null | undefined,
  fallbackMessage: string,
): string {
  const messages =
    errors
      ?.map((error) =>
        error.field ? `${error.field}: ${error.message}` : error.message,
      )
      .filter((message) => message.length > 0) ?? [];

  return messages.length > 0 ? messages.join('; ') : fallbackMessage;
}
