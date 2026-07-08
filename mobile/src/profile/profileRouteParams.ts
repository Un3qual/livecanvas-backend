export function readOptionalProfileIdParam(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) {
    if (value.length !== 1) {
      return null;
    }

    return readOptionalProfileIdParam(value[0]);
  }

  const profileId = typeof value === 'string' ? value.trim() : '';

  return profileId.length > 0 ? profileId : null;
}
