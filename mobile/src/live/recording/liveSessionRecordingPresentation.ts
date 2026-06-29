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

export function formatLiveSessionRecordingPresentation({
  processingState,
  publicUrl,
}: LiveSessionRecordingPresentationInput): LiveSessionRecordingPresentation {
  if (processingState === 'PROCESSED') {
    const normalizedPublicUrl = normalizePublicUrl(publicUrl);

    if (normalizedPublicUrl) {
      return {
        statusLabel: 'Replay ready',
        body: 'This session recording is ready to watch.',
        canOpen: true,
        publicUrl: normalizedPublicUrl,
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

function normalizePublicUrl(publicUrl: string | null | undefined): string | null {
  const trimmedPublicUrl = publicUrl?.trim();

  return trimmedPublicUrl ? trimmedPublicUrl : null;
}

function recordingUnavailable(): LiveSessionRecordingPresentation {
  return {
    statusLabel: 'Recording unavailable',
    body: 'The replay is not available yet.',
    canOpen: false,
    publicUrl: null,
  };
}
