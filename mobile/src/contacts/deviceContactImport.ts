import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

export const DEVICE_CONTACT_IMPORT_CHUNK_SIZE = 100;

export type DeviceContactImportEntry = {
  readonly contactClientId: string;
  readonly contactName: string | null;
  readonly emails: readonly string[];
  readonly phoneNumbers: readonly string[];
};

export type DeviceContactLike = {
  readonly [key: string]: unknown;
  readonly id?: unknown;
  readonly name?: unknown;
  readonly emails?: ReadonlyArray<{
    readonly [key: string]: unknown;
    readonly email?: unknown;
  }> | null;
  readonly phoneNumbers?: ReadonlyArray<{
    readonly [key: string]: unknown;
    readonly number?: unknown;
  }> | null;
};

/** Reduces native contacts to the only fields approved for server import. */
export function normalizeDeviceContacts(
  contacts: readonly DeviceContactLike[],
): readonly DeviceContactImportEntry[] {
  const entries: DeviceContactImportEntry[] = [];

  for (const contact of contacts) {
    const nativeId = normalizeRequiredString(contact.id);

    if (!nativeId) {
      continue;
    }

    const emails = normalizeContactValues(contact.emails, 'email', true);
    const phoneNumbers = normalizePhoneNumbers(contact.phoneNumbers);

    if (emails.length === 0 && phoneNumbers.length === 0) {
      continue;
    }

    entries.push({
      contactClientId: `device:${nativeId}`,
      contactName: normalizeRequiredString(contact.name),
      emails,
      phoneNumbers,
    });
  }

  return entries;
}

function normalizePhoneNumbers(
  values: DeviceContactLike['phoneNumbers'],
): readonly string[] {
  const normalizedValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values ?? []) {
    const rawPhoneNumber = normalizeRequiredString(value.number);

    if (!rawPhoneNumber) {
      continue;
    }

    // Match the backend's default region so the client never uploads a value
    // that can poison an otherwise valid atomic contact chunk.
    const phoneNumber = parsePhoneNumberFromString(rawPhoneNumber, 'US');

    if (!phoneNumber?.isValid() || seen.has(phoneNumber.number)) {
      continue;
    }

    seen.add(phoneNumber.number);
    normalizedValues.push(phoneNumber.number);
  }

  return normalizedValues;
}

export function chunkDeviceContactEntries(
  entries: readonly DeviceContactImportEntry[],
): readonly (readonly DeviceContactImportEntry[])[] {
  const chunks: DeviceContactImportEntry[][] = [];

  for (let index = 0; index < entries.length; index += DEVICE_CONTACT_IMPORT_CHUNK_SIZE) {
    chunks.push(entries.slice(index, index + DEVICE_CONTACT_IMPORT_CHUNK_SIZE));
  }

  return chunks;
}

function normalizeContactValues<Key extends 'email' | 'number'>(
  values: ReadonlyArray<Readonly<Partial<Record<Key, unknown>>>> | null | undefined,
  key: Key,
  lowercase: boolean,
): readonly string[] {
  const normalizedValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values ?? []) {
    const normalized = normalizeRequiredString(value[key]);

    if (!normalized) {
      continue;
    }

    const canonical = lowercase ? normalized.toLowerCase() : normalized;

    if (!seen.has(canonical)) {
      seen.add(canonical);
      normalizedValues.push(canonical);
    }
  }

  return normalizedValues;
}

function normalizeRequiredString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
