import { randomUUID } from 'expo-crypto';
import {
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
} from 'expo-secure-store';

import type { MagicLinkPayload } from './magicLinkLink';
import {
  clearMagicLinkHandoff as clearMagicLinkHandoffCore,
  storePendingMagicLinkReturnTo as storePendingMagicLinkReturnToCore,
  storeMagicLinkHandoff as storeMagicLinkHandoffCore,
  withMagicLinkHandoff as withMagicLinkHandoffCore,
  type MagicLinkHandoffResultPolicy,
  type MagicLinkHandoffPayload,
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
  callback: (payload: MagicLinkHandoffPayload) => Promise<Value>,
  policy?: MagicLinkHandoffResultPolicy<Value>,
): ReturnType<typeof withMagicLinkHandoffCore<Value>> {
  return withMagicLinkHandoffCore(requestedHandoffId, callback, {
    ...policy,
    storage: secureStorage,
  });
}

export function storePendingMagicLinkReturnTo(
  purpose: MagicLinkPayload['purpose'],
  returnTo: string,
): Promise<void> {
  return storePendingMagicLinkReturnToCore(purpose, returnTo, {
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
