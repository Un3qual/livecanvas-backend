import { describe, expect, test } from 'vitest';

import {
  canStartDeviceContactImport,
  createDeviceContactImportState,
  deviceContactImportMessage,
  reduceDeviceContactImport,
} from '../../src/contacts/deviceContactImportState';

describe('device contact import state', () => {
  test('admits one active attempt and tracks exact chunk progress', () => {
    let state = createDeviceContactImportState();

    expect(canStartDeviceContactImport(state)).toBe(true);
    state = reduceDeviceContactImport(state, { attemptId: 1, type: 'started' });
    expect(canStartDeviceContactImport(state)).toBe(false);

    state = reduceDeviceContactImport(state, {
      attemptId: 1,
      totalCount: 205,
      type: 'prepared',
    });
    state = reduceDeviceContactImport(state, {
      attemptId: 1,
      importedCount: 100,
      type: 'chunk_completed',
    });

    expect(state).toMatchObject({
      attemptId: 1,
      importedCount: 100,
      status: 'uploading',
      totalCount: 205,
    });
    expect(deviceContactImportMessage(state)).toBe('Imported 100 of 205 contacts...');

    state = reduceDeviceContactImport(state, {
      attemptId: 1,
      importedCount: 100,
      type: 'chunk_completed',
    });
    state = reduceDeviceContactImport(state, {
      attemptId: 1,
      importedCount: 5,
      type: 'chunk_completed',
    });
    state = reduceDeviceContactImport(state, { attemptId: 1, type: 'refreshing' });
    state = reduceDeviceContactImport(state, { attemptId: 1, type: 'completed' });

    expect(state).toMatchObject({ importedCount: 205, status: 'success' });
    expect(deviceContactImportMessage(state)).toBe('Imported 205 contacts.');
    expect(canStartDeviceContactImport(state)).toBe(true);
  });

  test('reports no importable contacts without entering upload state', () => {
    let state = reduceDeviceContactImport(createDeviceContactImportState(), {
      attemptId: 2,
      type: 'started',
    });

    state = reduceDeviceContactImport(state, {
      attemptId: 2,
      totalCount: 0,
      type: 'prepared',
    });

    expect(state.status).toBe('empty');
    expect(deviceContactImportMessage(state)).toBe(
      'No contacts with an email address or phone number were found.',
    );
  });

  test.each([
    ['denied', 'Allow contacts access in Settings to import your address book.'],
    ['unavailable', 'Device contact import is unavailable on this device.'],
    ['failed', 'We could not import your contacts. Try again.'],
  ] as const)('presents %s with viewer-safe copy', (type, message) => {
    let state = reduceDeviceContactImport(createDeviceContactImportState(), {
      attemptId: 3,
      type: 'started',
    });

    state = reduceDeviceContactImport(state, { attemptId: 3, type });

    expect(state.status).toBe(type === 'failed' ? 'error' : type);
    expect(deviceContactImportMessage(state)).toBe(message);
    expect(canStartDeviceContactImport(state)).toBe(true);
  });

  test('ignores stale completion from an older attempt', () => {
    let state = reduceDeviceContactImport(createDeviceContactImportState(), {
      attemptId: 4,
      type: 'started',
    });
    state = reduceDeviceContactImport(state, { attemptId: 4, type: 'failed' });
    state = reduceDeviceContactImport(state, { attemptId: 5, type: 'started' });
    state = reduceDeviceContactImport(state, {
      attemptId: 5,
      totalCount: 1,
      type: 'prepared',
    });

    expect(
      reduceDeviceContactImport(state, { attemptId: 4, type: 'completed' }),
    ).toBe(state);
    expect(
      reduceDeviceContactImport(state, {
        attemptId: 4,
        importedCount: 1,
        type: 'chunk_completed',
      }),
    ).toBe(state);
  });

  test('rejects impossible count transitions', () => {
    let state = reduceDeviceContactImport(createDeviceContactImportState(), {
      attemptId: 6,
      type: 'started',
    });
    state = reduceDeviceContactImport(state, {
      attemptId: 6,
      totalCount: 1,
      type: 'prepared',
    });

    expect(
      reduceDeviceContactImport(state, {
        attemptId: 6,
        importedCount: 2,
        type: 'chunk_completed',
      }),
    ).toMatchObject({ importedCount: 0, status: 'error' });
  });
});
