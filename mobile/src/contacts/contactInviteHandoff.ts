import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import * as HandoffCore from './contactInviteHandoffCore';

const secureStorage: HandoffCore.ContactInviteHandoffStorage = {
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
};

export type { ContactInviteHandoffStatus } from './contactInviteHandoffCore';

export function storeContactInviteHandoff(
  token: string,
): Promise<{ readonly handoffId: string }> {
  return HandoffCore.storeContactInviteHandoff(token, {
    createHandoffId: Crypto.randomUUID,
    storage: secureStorage,
  });
}

export function readContactInviteHandoffStatus(
  requestedHandoffId: string,
): Promise<HandoffCore.ContactInviteHandoffStatus> {
  return HandoffCore.readContactInviteHandoffStatus(requestedHandoffId, {
    storage: secureStorage,
  });
}

export function withContactInviteToken<Value>(
  requestedHandoffId: string,
  callback: (token: string) => Promise<Value>,
): ReturnType<typeof HandoffCore.withContactInviteToken<Value>> {
  return HandoffCore.withContactInviteToken(requestedHandoffId, callback, {
    storage: secureStorage,
  });
}

export function clearContactInviteHandoff(
  requestedHandoffId: string,
): Promise<boolean> {
  return HandoffCore.clearContactInviteHandoff(requestedHandoffId, {
    storage: secureStorage,
  });
}
