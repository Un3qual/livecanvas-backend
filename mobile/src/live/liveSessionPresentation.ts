export type LiveSessionStatus =
  | 'STARTING'
  | 'LIVE'
  | 'ENDED'
  | '%future added value';
export type LiveSessionVisibility = 'PUBLIC' | 'FOLLOWERS' | '%future added value';
export type LiveMutationError = {
  readonly field?: string | null;
  readonly message?: string | null;
};

export type LiveStatusPresentation = {
  readonly label: string;
  readonly tone: 'pending' | 'live' | 'ended';
};

type LiveSessionBadgeTheme = {
  readonly colors: {
    readonly accent: string;
    readonly accentText: string;
    readonly error: string;
    readonly errorMuted: string;
    readonly surfaceMuted: string;
    readonly textMuted: string;
  };
};

export type LiveSessionBadgeColors = {
  readonly surface: string;
  readonly text: string;
};

export function normalizeLiveSessionStatus(status: string): LiveSessionStatus {
  switch (status) {
    case 'STARTING':
    case 'LIVE':
    case 'ENDED':
      return status;
    default:
      return '%future added value';
  }
}

export function normalizeLiveSessionVisibility(
  visibility: string,
): LiveSessionVisibility {
  switch (visibility) {
    case 'PUBLIC':
    case 'FOLLOWERS':
      return visibility;
    default:
      return '%future added value';
  }
}

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

export function badgeColorsForLiveStatusTone(
  tone: LiveStatusPresentation['tone'],
  theme: LiveSessionBadgeTheme,
): LiveSessionBadgeColors {
  switch (tone) {
    case 'live':
      return {
        surface: theme.colors.accent,
        text: theme.colors.accentText,
      };
    case 'pending':
      return {
        surface: theme.colors.surfaceMuted,
        text: theme.colors.accent,
      };
    case 'ended':
      return {
        surface: theme.colors.errorMuted,
        text: theme.colors.error,
      };
    default:
      return {
        surface: theme.colors.surfaceMuted,
        text: theme.colors.textMuted,
      };
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
  const messages =
    errors
      ?.map((error) => error?.message?.trim())
      .filter(
        (message): message is string =>
          typeof message === 'string' && message.length > 0,
      ) ?? [];

  if (messages.includes('unauthenticated')) {
    return 'Sign in again to keep watching live sessions.';
  }

  if (messages.includes('rate_limited')) {
    return 'Too many live-session attempts. Wait a moment and try again.';
  }

  if (
    messages.some((message) =>
      ['not_authorized', 'not_found', 'ended'].includes(message),
    )
  ) {
    return 'This live session is not available to your account.';
  }

  return 'We could not update this live session. Check your connection and try again.';
}
