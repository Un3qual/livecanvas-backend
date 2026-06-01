export type LiveSessionStatus = 'STARTING' | 'LIVE' | 'ENDED' | string;
export type LiveSessionVisibility = 'PUBLIC' | 'FOLLOWERS' | string;
export type LiveMutationError = {
  readonly field?: string | null;
  readonly message?: string | null;
};

export type LiveStatusPresentation = {
  readonly label: string;
  readonly tone: 'pending' | 'live' | 'ended';
};

export function formatLiveSessionStatus(
  status: LiveSessionStatus,
): LiveStatusPresentation {
  switch (status) {
    case 'STARTING':
      return { label: 'Starting soon', tone: 'pending' };
    case 'LIVE':
      return { label: 'Live now', tone: 'live' };
    case 'ENDED':
      return { label: 'Ended', tone: 'ended' };
    default:
      return { label: 'Status unavailable', tone: 'ended' };
  }
}

export function canEnterLiveSession(status: LiveSessionStatus): boolean {
  return status === 'STARTING' || status === 'LIVE';
}

export function formatLiveSessionVisibility(
  visibility: LiveSessionVisibility,
): string {
  switch (visibility) {
    case 'PUBLIC':
      return 'Public';
    case 'FOLLOWERS':
      return 'Followers';
    default:
      return 'Visibility unavailable';
  }
}

function formatShortDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(parsed);
}

export function formatLiveSessionTiming({
  endedAt,
  insertedAt,
  startedAt,
  status,
}: {
  readonly endedAt?: string | null;
  readonly insertedAt: string;
  readonly startedAt?: string | null;
  readonly status: LiveSessionStatus;
}): string {
  if (status === 'ENDED') {
    const ended = formatShortDate(endedAt);
    return ended ? `Ended ${ended}` : 'Time unavailable';
  }

  if (status === 'LIVE') {
    const started = formatShortDate(startedAt);
    return started ? `Live since ${started}` : 'Time unavailable';
  }

  if (status === 'STARTING') {
    const created = formatShortDate(insertedAt);
    return created ? `Created ${created}` : 'Time unavailable';
  }

  return 'Time unavailable';
}

export function formatLiveMutationErrors(
  errors: ReadonlyArray<LiveMutationError> | null | undefined,
): string {
  const firstMessage = errors?.find((error) => error?.message)?.message;

  switch (firstMessage) {
    case 'rate_limited':
      return 'Too many live-session attempts. Wait a moment and try again.';
    case 'not_authorized':
    case 'not_found':
    case 'ended':
      return 'This live session is not available to your account.';
    case 'unauthenticated':
      return 'Sign in again to keep watching live sessions.';
    default:
      return 'We could not update this live session. Check your connection and try again.';
  }
}
