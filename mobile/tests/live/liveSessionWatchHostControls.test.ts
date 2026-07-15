import { describe, expect, vi, test } from 'vitest';
import { createElement, type ReactNode } from 'react';

import {
  createHostBroadcastLocalMediaControls,
  type HostBroadcastLocalMediaTrack,
} from '../../src/host/publishing/hostBroadcastLocalMediaControls';

function NativeComponent({
  children,
  ...props
}: {
  children?: ReactNode;
  [key: string]: unknown;
}) {
  return createElement('NativeComponent', props, children);
}

vi.doMock('react-native', () => ({
  Linking: {
    canOpenURL: () => Promise.resolve(false),
    openURL: () => Promise.resolve(),
  },
  Pressable: NativeComponent,
  StyleSheet: {
    create: <Styles>(styles: Styles): Styles => styles,
  },
  Text: NativeComponent,
  View: NativeComponent,
}));
vi.doMock('../../src/components/AppButton', () => ({
  AppButton: ({
    disabled,
    label,
    onPress,
  }: {
    disabled?: boolean;
    label: string;
    onPress: () => void;
  }) =>
    createElement(
      'Pressable',
      { accessibilityRole: 'button', disabled: disabled ?? false, onPress },
      label,
    ),
}));
vi.doMock('../../src/components/AppCard', () => ({
  AppCard: ({ children }: { children?: ReactNode }) =>
    createElement('View', null, children),
}));
vi.doMock('../../src/components/AppHeader', () => ({
  AppHeader: ({
    eyebrow,
    subtitle,
    title,
  }: {
    eyebrow?: string;
    subtitle?: string;
    title: string;
  }) => createElement('View', null, eyebrow, title, subtitle),
}));
vi.doMock('../../src/theme/tokens', () => ({
  radius: { md: 8 },
  spacing: { lg: 16, sm: 8 },
  touchTarget: { min: 44 },
  typography: { label: {} },
}));
vi.doMock('../../src/live/watch/liveSessionWatchScreenStyles', () => ({
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
vi.doMock('../../src/providers/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      error: 'error',
      text: 'text',
      textMuted: 'textMuted',
    },
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

  test('hides host controls for unknown future live session statuses', () => {
    expect(typeof createLiveSessionWatchHostMediaControls).toBe('function');
    if (!createLiveSessionWatchHostMediaControls) {
      return;
    }

    const { controls } = createTracks();

    expect(
      createLiveSessionWatchHostMediaControls({
        controls,
        isHostOwnedSession: true,
        normalizedStatus: '%future added value',
        onSnapshotChanged() {
          throw new Error('hidden controls should not update snapshots');
        },
        snapshot: controls.snapshot(),
      }),
    ).toBeNull();
  });

  test('toggles host media from the latest snapshot when pressed', () => {
    expect(typeof createLiveSessionWatchHostMediaControls).toBe('function');
    if (!createLiveSessionWatchHostMediaControls) {
      return;
    }

    const { controls, tracks } = createTracks();
    const initialSnapshot = controls.snapshot();
    const snapshots: Array<ReturnType<typeof controls.snapshot>> = [];
    const hostControls = createLiveSessionWatchHostMediaControls({
      controls,
      isHostOwnedSession: true,
      normalizedStatus: 'LIVE',
      onSnapshotChanged: (snapshot) => {
        snapshots.push(snapshot);
      },
      snapshot: initialSnapshot,
    });

    controls.setAudioEnabled(false);
    hostControls?.audio?.onPress();

    expect(tracks[0].enabled).toBe(true);
    expect(snapshots.at(-1)).toEqual({
      audio: { available: true, enabled: true },
      video: { available: true, enabled: true },
    });
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
