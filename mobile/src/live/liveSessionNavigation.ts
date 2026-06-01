export function liveSessionHref(sessionId: string) {
  return {
    pathname: '/live-session' as const,
    params: { sessionId },
  };
}

export function readLiveSessionIdParam(
  value?: string | string[],
): string | null {
  const raw = Array.isArray(value)
    ? value.find((candidate) => candidate.trim().length > 0)
    : value;
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
