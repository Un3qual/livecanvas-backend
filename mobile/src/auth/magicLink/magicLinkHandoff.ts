import { randomUUID } from 'expo-crypto';
import {
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
} from 'expo-secure-store';

import type { MagicLinkPayload } from './magicLinkLink';
import {
  clearMagicLinkHandoff as clearMagicLinkHandoffCore,
  storeMagicLinkHandoff as storeMagicLinkHandoffCore,
  withMagicLinkHandoff as withMagicLinkHandoffCore,
  type MagicLinkHandoffStorage,
} from './magicLinkHandoffCore';

const secureStorage: MagicLinkHandoffStorage = {
  deleteItem: (key) => deleteItemAsync(key),
  getItem: (key) => getItemAsync(key),
  setItem: (key, value) => setItemAsync(key, value),
};

export function storeMagicLinkHandoff(
  payload: MagicLinkPayload,
): Promise<{ readonly handoffId: string }> {
  return storeMagicLinkHandoffCore(payload, {
    createHandoffId: randomUUID,
    storage: secureStorage,
  });
}

export function withMagicLinkHandoff<Value>(
  requestedHandoffId: string,
  callback: (payload: MagicLinkPayload) => Promise<Value>,
): ReturnType<typeof withMagicLinkHandoffCore<Value>> {
  return withMagicLinkHandoffCore(requestedHandoffId, callback, {
    storage: secureStorage,
  });
}

export function clearMagicLinkHandoff(
  requestedHandoffId: string,
): Promise<boolean> {
  return clearMagicLinkHandoffCore(requestedHandoffId, {
    storage: secureStorage,
  });
}
