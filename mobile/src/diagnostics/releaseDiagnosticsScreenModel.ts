import type { AuthState } from '../auth/types';
import type { AppEnvironment } from '../config/environment';
import type { StartupSnapshot } from '../config/runtime';
import {
  describeDiagnosticsEndpoint,
  formatAuthStatus,
  formatBootSessionState,
  formatProbeStatus,
  formatTokenSafeDiagnosticUrl,
  type DiagnosticsEndpointPresentation,
  type DiagnosticsProbeStatus,
} from './releaseDiagnosticsPresentation';

export type DiagnosticsStateRow = {
  label: string;
  value: string;
};

export type DiagnosticsProbeRow = {
  actionLabel: string;
  disabled: boolean;
  label: string;
  statusLabel: string;
};

export type ReleaseDiagnosticsScreenModelInput = {
  apiProbeStatus: DiagnosticsProbeStatus;
  authStatus: AuthState['status'];
  environment: AppEnvironment;
  snapshot: StartupSnapshot;
  websocketProbeStatus: DiagnosticsProbeStatus;
};

export type ReleaseDiagnosticsScreenModel = {
  endpointRows: DiagnosticsEndpointPresentation[];
  probeRows: DiagnosticsProbeRow[];
  stateRows: DiagnosticsStateRow[];
};

export function createReleaseDiagnosticsScreenModel({
  apiProbeStatus,
  authStatus,
  environment,
  snapshot,
  websocketProbeStatus,
}: ReleaseDiagnosticsScreenModelInput): ReleaseDiagnosticsScreenModel {
  return {
    endpointRows: [
      describeDiagnosticsEndpoint({
        label: 'API URL',
        url: environment.apiBaseUrl,
      }),
      describeDiagnosticsEndpoint({
        label: 'Websocket URL',
        url: environment.websocketUrl,
      }),
    ],
    probeRows: [
      {
        actionLabel: 'Check API',
        disabled: apiProbeStatus.status === 'checking',
        label: 'API probe',
        statusLabel: formatProbeStatus(apiProbeStatus),
      },
      {
        actionLabel: 'Check websocket',
        disabled: websocketProbeStatus.status === 'checking',
        label: 'Websocket probe',
        statusLabel: formatProbeStatus(websocketProbeStatus),
      },
    ],
    stateRows: [
      {
        label: 'Boot session',
        value: formatBootSessionState(snapshot.bootSessionState),
      },
      {
        label: 'Current auth',
        value: formatAuthStatus(authStatus),
      },
      {
        label: 'Initial URL',
        value: formatOptionalUrl(snapshot.initialUrl),
      },
      {
        label: 'Initial href',
        value: formatOptionalUrl(snapshot.initialHref),
      },
      {
        label: 'Landing href',
        value: formatTokenSafeDiagnosticUrl(snapshot.landingHref),
      },
      {
        label: 'Default href',
        value: formatTokenSafeDiagnosticUrl(snapshot.defaultHref),
      },
      {
        label: 'Reset reason',
        value: snapshot.resetReason ?? 'None',
      },
    ],
  };
}

function formatOptionalUrl(value: string | null): string {
  return value ? formatTokenSafeDiagnosticUrl(value) : 'None';
}
