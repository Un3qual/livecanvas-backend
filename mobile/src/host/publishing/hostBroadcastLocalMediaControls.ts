export type HostBroadcastLocalMediaTrack = {
  enabled?: boolean;
  kind?: string | null;
  readyState?: string | null;
};

export type HostBroadcastLocalMediaStream = {
  readonly getTracks?: () => ReadonlyArray<unknown> | null | undefined;
};

export type HostBroadcastLocalMediaControlsSnapshot = Readonly<{
  audio: HostBroadcastLocalMediaControlsGroupSnapshot;
  video: HostBroadcastLocalMediaControlsGroupSnapshot;
}>;

export type HostBroadcastLocalMediaControlsGroupSnapshot = Readonly<{
  available: boolean;
  enabled: boolean;
}>;

export type HostBroadcastLocalMediaControls = Readonly<{
  setAudioEnabled: (enabled: boolean) => void;
  setVideoEnabled: (enabled: boolean) => void;
  snapshot: () => HostBroadcastLocalMediaControlsSnapshot;
}>;

type MediaTrackKind = 'audio' | 'video';

export function createHostBroadcastLocalMediaControls(
  stream: HostBroadcastLocalMediaStream | null | undefined,
): HostBroadcastLocalMediaControls | null {
  if (!stream) {
    return null;
  }

  const localStream = stream;

  function tracksFor(kind: MediaTrackKind): HostBroadcastLocalMediaTrack[] {
    return readLocalMediaTracks(localStream).filter(
      (track) => track.kind === kind && track.readyState !== 'ended',
    );
  }

  function setEnabled(kind: MediaTrackKind, enabled: boolean): void {
    for (const track of tracksFor(kind)) {
      trySetTrackEnabled(track, enabled);
    }
  }

  function groupSnapshot(
    kind: MediaTrackKind,
  ): HostBroadcastLocalMediaControlsGroupSnapshot {
    const tracks = tracksFor(kind);

    if (tracks.length === 0) {
      return {
        available: false,
        enabled: false,
      };
    }

    return {
      available: true,
      enabled: tracks.every((track) => track.enabled !== false),
    };
  }

  return {
    setAudioEnabled(enabled) {
      setEnabled('audio', enabled);
    },
    setVideoEnabled(enabled) {
      setEnabled('video', enabled);
    },
    snapshot() {
      return {
        audio: groupSnapshot('audio'),
        video: groupSnapshot('video'),
      };
    },
  };
}

function trySetTrackEnabled(
  track: HostBroadcastLocalMediaTrack,
  enabled: boolean,
): void {
  try {
    track.enabled = enabled;
  } catch {
    // Ignore accepted local track objects that expose non-writable properties.
  }
}

function readLocalMediaTracks(
  stream: HostBroadcastLocalMediaStream,
): HostBroadcastLocalMediaTrack[] {
  try {
    const tracks = stream.getTracks?.() ?? [];

    if (!Array.isArray(tracks)) {
      return [];
    }

    return tracks.filter(isLocalMediaTrack);
  } catch {
    // Treat unreadable preview streams as having no controllable tracks.
    return [];
  }
}

function isLocalMediaTrack(
  track: unknown,
): track is HostBroadcastLocalMediaTrack {
  if (!track || typeof track !== 'object') {
    return false;
  }

  const { kind } = track as HostBroadcastLocalMediaTrack;

  return kind === 'audio' || kind === 'video';
}
