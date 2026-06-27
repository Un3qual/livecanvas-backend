import type { ComponentType } from 'react';

import type {
  LiveSessionRTCViewProps,
  ReactNativeWebRtcViewModule,
} from './liveSessionWatchScreenTypes';

declare const require:
  | undefined
  | ((moduleName: 'react-native-webrtc') => ReactNativeWebRtcViewModule);

export const LiveSessionRTCView = resolveLiveSessionRTCView();

function resolveLiveSessionRTCView(): ComponentType<LiveSessionRTCViewProps> | null {
  if (typeof require === 'undefined') {
    return null;
  }

  try {
    return require('react-native-webrtc').RTCView ?? null;
  } catch {
    return null;
  }
}

