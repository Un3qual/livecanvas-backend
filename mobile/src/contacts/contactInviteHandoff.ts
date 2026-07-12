import { randomUUID } from 'expo-crypto';
import {
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
} from 'expo-secure-store';

import {
  clearContactInviteHandoff as clearContactInviteHandoffCore,
  readContactInviteHandoffStatus as readContactInviteHandoffStatusCore,
  storeContactInviteHandoff as storeContactInviteHandoffCore,
  withContactInviteToken as withContactInviteTokenCore,
  type ContactInviteHandoffStatus,
  type ContactInviteHandoffStorage,
} from './contactInviteHandoffCore';

const secureStorage: ContactInviteHandoffStorage = {
  deleteItem: (key) => deleteItemAsync(key),
  getItem: (key) => getItemAsync(key),
  setItem: (key, value) => setItemAsync(key, value),
};

export type { ContactInviteHandoffStatus } from './contactInviteHandoffCore';

export function storeContactInviteHandoff(
  token: string,
): Promise<{ readonly handoffId: string }> {
  return storeContactInviteHandoffCore(token, {
    createHandoffId: randomUUID,
    storage: secureStorage,
  });
}

export function readContactInviteHandoffStatus(
  requestedHandoffId: string,
): Promise<ContactInviteHandoffStatus> {
  return readContactInviteHandoffStatusCore(requestedHandoffId, {
    storage: secureStorage,
  });
}

export function withContactInviteToken<Value>(
  requestedHandoffId: string,
  callback: (token: string) => Promise<Value>,
): ReturnType<typeof withContactInviteTokenCore<Value>> {
  return withContactInviteTokenCore(requestedHandoffId, callback, {
    storage: secureStorage,
  });
}

export function clearContactInviteHandoff(
  requestedHandoffId: string,
): Promise<boolean> {
  return clearContactInviteHandoffCore(requestedHandoffId, {
    storage: secureStorage,
  });
}
