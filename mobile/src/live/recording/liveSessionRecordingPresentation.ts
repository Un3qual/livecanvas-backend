export type LiveSessionRecordingPresentationInput = {
  readonly processingState: string | null | undefined;
  readonly publicUrl?: string | null;
};

export type LiveSessionRecordingPresentation = {
  readonly statusLabel: string;
  readonly body: string;
  readonly canOpen: boolean;
  readonly publicUrl: string | null;
};

export type NormalizedLiveSessionRecordingPublicUrl = {
  readonly protocol: string;
  readonly publicUrl: string;
};

export function formatLiveSessionRecordingPresentation({
  processingState,
  publicUrl,
}: LiveSessionRecordingPresentationInput): LiveSessionRecordingPresentation {
  if (processingState === 'PROCESSED') {
    const normalizedPublicUrl = normalizeLiveSessionRecordingPublicUrl(publicUrl);

    if (normalizedPublicUrl) {
      return {
        statusLabel: 'Replay ready',
        body: 'This session recording is ready to watch.',
        canOpen: true,
        publicUrl: normalizedPublicUrl.publicUrl,
      };
    }

    return recordingUnavailable();
  }

  if (processingState === 'PENDING_UPLOAD' || processingState === 'UPLOADED') {
    return {
      statusLabel: 'Recording processing',
      body: 'The recording is still being prepared. Check back soon.',
      canOpen: false,
      publicUrl: null,
    };
  }

  if (processingState === 'FAILED') {
    return {
      statusLabel: 'Recording failed',
      body: 'The recording could not be processed.',
      canOpen: false,
      publicUrl: null,
    };
  }

  return recordingUnavailable();
}

export function normalizeLiveSessionRecordingPublicUrl(
  publicUrl: string | null | undefined,
): NormalizedLiveSessionRecordingPublicUrl | null {
  const trimmedPublicUrl = publicUrl?.trim();

  if (!trimmedPublicUrl) {
    return null;
  }

  const parsedPublicUrl = parsePublicUrl(trimmedPublicUrl);

  if (!parsedPublicUrl) {
    return null;
  }

  return {
    protocol: parsedPublicUrl.protocol,
    publicUrl: trimmedPublicUrl,
  };
}

function recordingUnavailable(): LiveSessionRecordingPresentation {
  return {
    statusLabel: 'Recording unavailable',
    body: 'The replay is not available yet.',
    canOpen: false,
    publicUrl: null,
  };
}

function parsePublicUrl(publicUrl: string): URL | null {
  try {
    return new URL(publicUrl);
  } catch {
    return null;
  }
}
