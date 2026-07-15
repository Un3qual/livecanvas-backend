import { useCallback, useEffect, useReducer, useRef } from 'react';
import { Linking } from 'react-native';
import { useMutation } from 'react-relay';

import {
  chunkDeviceContactEntries,
  type DeviceContactImportEntry,
} from './deviceContactImport';
import {
  canStartDeviceContactImport,
  createDeviceContactImportState,
  deviceContactImportMessage,
  reduceDeviceContactImport,
} from './deviceContactImportState';
import { readDeviceContacts } from './deviceContactsNative';
import {
  contactDiscoveryImportMutation,
  type ContactDiscoveryImportMutation,
} from './contactDiscoveryOperations';

type DeviceContactImportOptions = {
  readonly onImported: () => Promise<void>;
};

type DeviceContactImportController = {
  readonly importContacts: () => Promise<void>;
  readonly isImporting: boolean;
  readonly message: string | null;
  readonly openSettings: () => Promise<void>;
  readonly status: ReturnType<typeof createDeviceContactImportState>['status'];
};

/** Owns one import attempt at a time and ignores completions after unmount. */
export function useDeviceContactImport({
  onImported,
}: DeviceContactImportOptions): DeviceContactImportController {
  const [commitImport] = useMutation<ContactDiscoveryImportMutation>(
    contactDiscoveryImportMutation,
  );
  const [state, dispatch] = useReducer(
    reduceDeviceContactImport,
    undefined,
    createDeviceContactImportState,
  );
  const stateRef = useRef(state);
  const attemptSequenceRef = useRef(0);
  const activeAttemptRef = useRef<number | null>(null);
  stateRef.current = state;

  useEffect(
    () => () => {
      activeAttemptRef.current = null;
    },
    [],
  );

  const uploadChunk = useCallback(
    (entries: readonly DeviceContactImportEntry[]) =>
      new Promise<number>((resolve, reject) => {
        commitImport({
          variables: { input: { entries: [...entries] } },
          onCompleted: (payload, relayErrors) => {
            const result = payload.importViewerContactEntries;

            if (
              relayErrors?.length ||
              !result ||
              result.errors.length > 0 ||
              result.importedCount !== entries.length
            ) {
              reject(new Error('Contact import was not accepted.'));
              return;
            }

            resolve(result.importedCount);
          },
          onError: reject,
        });
      }),
    [commitImport],
  );

  const importContacts = useCallback(async () => {
    if (
      activeAttemptRef.current !== null ||
      !canStartDeviceContactImport(stateRef.current)
    ) {
      return;
    }

    const attemptId = ++attemptSequenceRef.current;
    activeAttemptRef.current = attemptId;
    dispatch({ attemptId, type: 'started' });

    try {
      let uploadedCount = 0;
      const readResult = await readDeviceContacts({
        onEntries: async (entries) => {
          if (activeAttemptRef.current !== attemptId) {
            throw new Error('Contact import attempt is no longer active.');
          }

          dispatch({
            attemptId,
            entryCount: entries.length,
            type: 'page_prepared',
          });

          for (const chunk of chunkDeviceContactEntries(entries)) {
            const importedCount = await uploadChunk(chunk);

            if (activeAttemptRef.current !== attemptId) {
              throw new Error('Contact import attempt is no longer active.');
            }

            uploadedCount += importedCount;
            dispatch({ attemptId, importedCount, type: 'chunk_completed' });
          }
        },
      });

      if (activeAttemptRef.current !== attemptId) {
        return;
      }

      if (readResult.status !== 'granted') {
        dispatch({ attemptId, type: readResult.status });
        activeAttemptRef.current = null;
        return;
      }

      if (readResult.entryCount !== uploadedCount) {
        throw new Error('Contact import count did not match the native read.');
      }

      dispatch({ attemptId, type: 'reading_completed' });

      if (readResult.entryCount === 0) {
        activeAttemptRef.current = null;
        return;
      }
      await onImported();

      if (activeAttemptRef.current !== attemptId) {
        return;
      }

      dispatch({ attemptId, type: 'completed' });
      activeAttemptRef.current = null;
    } catch {
      if (activeAttemptRef.current === attemptId) {
        dispatch({ attemptId, type: 'failed' });
        activeAttemptRef.current = null;
      }
    }
  }, [onImported, uploadChunk]);

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      // Settings availability is platform-owned; the manual flow remains usable.
    }
  }, []);

  return {
    importContacts,
    isImporting: !canStartDeviceContactImport(state),
    message: deviceContactImportMessage(state),
    openSettings,
    status: state.status,
  };
}
