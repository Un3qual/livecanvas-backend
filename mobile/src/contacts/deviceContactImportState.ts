export type DeviceContactImportStatus =
  | 'idle'
  | 'reading'
  | 'uploading'
  | 'refreshing'
  | 'success'
  | 'empty'
  | 'denied'
  | 'unavailable'
  | 'error';

export type DeviceContactImportState = {
  readonly attemptId: number | null;
  readonly importedCount: number;
  readonly status: DeviceContactImportStatus;
  readonly totalCount: number;
};

export type DeviceContactImportEvent =
  | { readonly attemptId: number; readonly type: 'started' }
  | {
      readonly attemptId: number;
      readonly entryCount: number;
      readonly type: 'page_prepared';
    }
  | {
      readonly attemptId: number;
      readonly importedCount: number;
      readonly type: 'chunk_completed';
    }
  | {
      readonly attemptId: number;
      readonly type: 'reading_completed' | 'completed';
    }
  | {
      readonly attemptId: number;
      readonly type: 'denied' | 'unavailable' | 'failed';
    };

export function createDeviceContactImportState(): DeviceContactImportState {
  return {
    attemptId: null,
    importedCount: 0,
    status: 'idle',
    totalCount: 0,
  };
}

export function canStartDeviceContactImport(
  state: DeviceContactImportState,
): boolean {
  return !['reading', 'uploading', 'refreshing'].includes(state.status);
}

export function reduceDeviceContactImport(
  state: DeviceContactImportState,
  event: DeviceContactImportEvent,
): DeviceContactImportState {
  if (event.type === 'started') {
    return canStartDeviceContactImport(state)
      ? {
          attemptId: event.attemptId,
          importedCount: 0,
          status: 'reading',
          totalCount: 0,
        }
      : state;
  }

  if (state.attemptId !== event.attemptId) {
    return state;
  }

  switch (event.type) {
    case 'page_prepared': {
      if (
        !['reading', 'uploading'].includes(state.status) ||
        event.entryCount < 0
      ) {
        return failedState(state);
      }

      const totalCount = state.totalCount + event.entryCount;

      return {
        ...state,
        status: totalCount === 0 ? 'reading' : 'uploading',
        totalCount,
      };
    }
    case 'chunk_completed': {
      if (state.status !== 'uploading' || event.importedCount <= 0) {
        return failedState(state);
      }

      const importedCount = state.importedCount + event.importedCount;

      return importedCount <= state.totalCount
        ? { ...state, importedCount }
        : failedState(state);
    }
    case 'reading_completed':
      if (state.totalCount === 0 && state.status === 'reading') {
        return { ...state, status: 'empty' };
      }

      return state.status === 'uploading' &&
        state.importedCount === state.totalCount
        ? { ...state, status: 'refreshing' }
        : failedState(state);
    case 'completed':
      return state.status === 'refreshing'
        ? { ...state, status: 'success' }
        : failedState(state);
    case 'denied':
      return { ...state, status: 'denied' };
    case 'unavailable':
      return { ...state, status: 'unavailable' };
    case 'failed':
      return failedState(state);
    default:
      return assertNever(event);
  }
}

export function deviceContactImportMessage(
  state: DeviceContactImportState,
): string | null {
  switch (state.status) {
    case 'idle':
      return null;
    case 'reading':
      return 'Reading contacts...';
    case 'uploading':
      return state.importedCount === 0
        ? 'Preparing contacts...'
        : `Imported ${state.importedCount} contacts...`;
    case 'refreshing':
      return 'Refreshing contact matches...';
    case 'success':
      return `Imported ${state.importedCount} contacts.`;
    case 'empty':
      return 'No contacts with an email address or phone number were found.';
    case 'denied':
      return 'Allow contacts access in Settings to import your address book.';
    case 'unavailable':
      return 'Device contact import is unavailable on this device.';
    case 'error':
      return 'We could not import your contacts. Try again.';
    default:
      return assertNever(state.status);
  }
}

function failedState(
  state: DeviceContactImportState,
): DeviceContactImportState {
  return { ...state, status: 'error' };
}

function assertNever(value: never): never {
  throw new Error(`Unexpected device contact import value: ${String(value)}`);
}
