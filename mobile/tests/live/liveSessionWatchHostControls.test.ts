import { describe, expect, mock, test } from 'bun:test';

import {
  createHostBroadcastLocalMediaControls,
  type HostBroadcastLocalMediaTrack,
} from '../../src/host/publishing/hostBroadcastLocalMediaControls';

function NullComponent() {
  return null;
}

mock.module('react-native', () => ({
  Linking: {
    canOpenURL: () => Promise.resolve(false),
    openURL: () => Promise.resolve(),
  },
  Pressable: NullComponent,
  StyleSheet: {
    create: <Styles>(styles: Styles): Styles => styles,
  },
  Text: NullComponent,
  View: NullComponent,
}));
mock.module('../../src/components/AppButton', () => ({
  AppButton: NullComponent,
}));
mock.module('../../src/components/AppCard', () => ({
  AppCard: NullComponent,
}));
mock.module('../../src/components/AppHeader', () => ({
  AppHeader: NullComponent,
}));
mock.module('../../src/theme/tokens', () => ({
  radius: { md: 8 },
  spacing: { lg: 16, sm: 8 },
  touchTarget: { min: 44 },
  typography: { label: {} },
}));
mock.module('../../src/live/watch/liveSessionWatchScreenStyles', () => ({
  liveSessionWatchScreenStyles: {
    badge: {},
    badgeText: {},
    bodyText: {},
    errorText: {},
    heroHeader: {},
    metadataLabel: {},
    metadataRow: {},
    metadataValue: {},
    recordingMetadata: {},
    sectionTitle: {},
    unavailable: {},
  },
}));
mock.module('../../src/providers/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      error: 'error',
      text: 'text',
      textMuted: 'textMuted',
    },
  }),
}));
mock.module('../../src/live/recording/liveSessionRecordingPresentation', () => ({
  formatLiveSessionRecordingPresentation: () => ({
    body: 'Recording unavailable.',
    canOpen: false,
    publicUrl: null,
    statusLabel: 'Unavailable',
  }),
}));

const watchCards = await import(
  '../../src/live/watch/components/LiveSessionWatchCards'
);

const createLiveSessionWatchHostMediaControls =
  watchCards.createLiveSessionWatchHostMediaControls as
    | ((
        options: Parameters<CreateHostControls>[0],
      ) => ReturnType<CreateHostControls>)
    | undefined;
const LiveSessionWatchControlsCard = watchCards.LiveSessionWatchControlsCard;

type CreateHostControls = typeof import('../../src/live/watch/components/LiveSessionWatchCards').createLiveSessionWatchHostMediaControls;

type ElementLike = {
  readonly props?: {
    readonly children?: unknown;
    readonly label?: unknown;
    readonly onPress?: unknown;
  };
};

function createTracks() {
  const tracks: HostBroadcastLocalMediaTrack[] = [
    { enabled: true, kind: 'audio' },
    { enabled: true, kind: 'video' },
  ];
  const controls = createHostBroadcastLocalMediaControls({
    getTracks() {
      return tracks;
    },
  });

  if (!controls) {
    throw new Error('expected local media controls');
  }

  return { controls, tracks };
}

function collectButtonLabels(node: unknown): string[] {
  if (Array.isArray(node)) {
    return node.flatMap(collectButtonLabels);
  }

  if (!node || typeof node !== 'object') {
    return [];
  }

  const element = node as ElementLike;
  const label =
    typeof element.props?.label === 'string' &&
    typeof element.props.onPress === 'function'
      ? [element.props.label]
      : [];

  return [
    ...label,
    ...collectButtonLabels(element.props?.children),
  ];
}

function renderControlsCard(
  hostControls: ReturnType<CreateHostControls>,
) {
  return LiveSessionWatchControlsCard({
    canEndLiveSession: false,
    enterable: true,
    hasActiveSubmission: false,
    hostControls,
    isEnding: false,
    isHostOwnedSession: true,
    isJoined: false,
    isJoining: false,
    isLeaving: false,
    normalizedStatus: 'LIVE',
    onEndPress() {
      throw new Error('end should not be called');
    },
    onJoinPress() {
      throw new Error('join should not be called');
    },
    onLeavePress() {
      throw new Error('leave should not be called');
    },
    watchError: null,
  });
}

describe('live session watch host controls', () => {
  test('builds host mic and camera toggles from retained local media controls', () => {
    expect(typeof createLiveSessionWatchHostMediaControls).toBe('function');
    if (!createLiveSessionWatchHostMediaControls) {
      return;
    }

    const { controls, tracks } = createTracks();
    const snapshots: Array<ReturnType<typeof controls.snapshot>> = [];
    const hostControls = createLiveSessionWatchHostMediaControls({
      controls,
      isHostOwnedSession: true,
      normalizedStatus: 'LIVE',
      onSnapshotChanged: (snapshot) => {
        snapshots.push(snapshot);
      },
      snapshot: controls.snapshot(),
    });

    expect(hostControls?.audio?.label).toBe('Mute mic');
    expect(hostControls?.video?.label).toBe('Turn camera off');
    expect(collectButtonLabels(renderControlsCard(hostControls))).toEqual([
      'Mute mic',
      'Turn camera off',
    ]);

    hostControls?.audio?.onPress();

    expect(tracks[0].enabled).toBe(false);
    expect(tracks[1].enabled).toBe(true);
    expect(snapshots.at(-1)).toEqual({
      audio: { available: true, enabled: false },
      video: { available: true, enabled: true },
    });

    const updatedHostControls = createLiveSessionWatchHostMediaControls({
      controls,
      isHostOwnedSession: true,
      normalizedStatus: 'LIVE',
      onSnapshotChanged: (snapshot) => {
        snapshots.push(snapshot);
      },
      snapshot: snapshots.at(-1) ?? controls.snapshot(),
    });

    expect(updatedHostControls?.audio?.label).toBe('Unmute mic');
    updatedHostControls?.video?.onPress();

    expect(tracks[0].enabled).toBe(false);
    expect(tracks[1].enabled).toBe(false);
    expect(snapshots.at(-1)).toEqual({
      audio: { available: true, enabled: false },
      video: { available: true, enabled: false },
    });
  });

  test('hides host controls for viewers, ended sessions, and unavailable media groups', () => {
    expect(typeof createLiveSessionWatchHostMediaControls).toBe('function');
    if (!createLiveSessionWatchHostMediaControls) {
      return;
    }

    const { controls } = createTracks();
    const snapshot = controls.snapshot();
    const onSnapshotChanged = () => {
      throw new Error('hidden controls should not update snapshots');
    };

    expect(
      createLiveSessionWatchHostMediaControls({
        controls,
        isHostOwnedSession: false,
        normalizedStatus: 'LIVE',
        onSnapshotChanged,
        snapshot,
      }),
    ).toBeNull();
    expect(
      createLiveSessionWatchHostMediaControls({
        controls,
        isHostOwnedSession: true,
        normalizedStatus: 'ENDED',
        onSnapshotChanged,
        snapshot,
      }),
    ).toBeNull();
    expect(
      createLiveSessionWatchHostMediaControls({
        controls: null,
        isHostOwnedSession: true,
        normalizedStatus: 'LIVE',
        onSnapshotChanged,
        snapshot: null,
      }),
    ).toBeNull();
  });

  test('shows only controls for available media types', () => {
    expect(typeof createLiveSessionWatchHostMediaControls).toBe('function');
    if (!createLiveSessionWatchHostMediaControls) {
      return;
    }

    const controls = createHostBroadcastLocalMediaControls({
      getTracks() {
        return [{ enabled: true, kind: 'audio' }];
      },
    });

    if (!controls) {
      throw new Error('expected local media controls');
    }

    const hostControls = createLiveSessionWatchHostMediaControls({
      controls,
      isHostOwnedSession: true,
      normalizedStatus: 'LIVE',
      onSnapshotChanged() {
        // The test only checks presentation for partial availability.
      },
      snapshot: controls.snapshot(),
    });

    expect(collectButtonLabels(renderControlsCard(hostControls))).toEqual([
      'Mute mic',
    ]);
  });
});
