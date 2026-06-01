export function liveSessionHref(sessionId: string) {
  return {
    pathname: '/live-session' as const,
    params: { sessionId },
  };
}

export function readLiveSessionIdParam(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
