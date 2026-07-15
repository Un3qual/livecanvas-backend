import type { AuthMutationError } from '../authMutationClient';

const DEFINITIVE_CODES = new Set([
  'INVALID_CREDENTIALS',
  'INVALID_INPUT',
  'TOKEN_EXPIRED',
]);

export function readMagicLinkHandoffParam(
  rawHandoffId: string | string[] | undefined,
): string | null {
  if (Array.isArray(rawHandoffId)) {
    return null;
  }

  const handoffId = rawHandoffId?.trim();

  return handoffId && /^[A-Za-z0-9_-]{8,128}$/.test(handoffId)
    ? handoffId
    : null;
}

export function isDefinitiveMagicLinkRejection(
  errors: readonly AuthMutationError[],
): boolean {
  return errors.some((error) => {
    const code = error.code?.trim().toUpperCase();
    if (code && DEFINITIVE_CODES.has(code)) {
      return true;
    }

    const message = error.message.trim().toLowerCase();
    return (
      message === 'invalid_credentials' ||
      message.includes('invalid or expired')
    );
  });
}
