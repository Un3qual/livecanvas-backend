import { storeContactInviteHandoff } from './contactInviteHandoff';

type ParsedContactInviteLink =
  | { readonly status: 'invalid' }
  | { readonly status: 'not_invite' }
  | { readonly status: 'valid'; readonly token: string };

export async function redirectContactInviteSystemPath(
  path: string,
): Promise<string> {
  const parsed = parseContactInviteLink(path);

  if (parsed.status === 'not_invite') {
    return path;
  }

  if (parsed.status === 'invalid') {
    return '/invite';
  }

  try {
    const { handoffId } = await storeContactInviteHandoff(parsed.token);
    return `/invite?handoff=${encodeURIComponent(handoffId)}`;
  } catch {
    return '/invite';
  }
}

export function redactContactInviteSnapshotUrl(
  initialUrl: string | null,
): string | null {
  if (!initialUrl) {
    return initialUrl;
  }

  return parseContactInviteLink(initialUrl).status === 'not_invite'
    ? initialUrl
    : '/invite';
}

function parseContactInviteLink(path: string): ParsedContactInviteLink {
  const isInviteCandidate = looksLikeContactInviteCandidate(path);
  let parsed: URL;

  try {
    parsed = new URL(path);
  } catch {
    return isInviteCandidate
      ? { status: 'invalid' }
      : { status: 'not_invite' };
  }

  if (
    parsed.protocol === 'livecanvas-mobile:' &&
    parsed.hostname === 'invite' &&
    (parsed.pathname === '' || parsed.pathname === '/')
  ) {
    if (hasUnexpectedAuthority(parsed) || parsed.hash) {
      return { status: 'invalid' };
    }

    return parseSingleTokenParameters(path.slice(path.indexOf('?') + 1));
  }

  if (
    parsed.protocol === 'https:' &&
    Boolean(parsed.hostname) &&
    parsed.pathname === '/invites'
  ) {
    if (hasUnexpectedAuthority(parsed) || parsed.search) {
      return { status: 'invalid' };
    }

    return parseSingleTokenParameters(parsed.hash.slice(1));
  }

  return isInviteCandidate ? { status: 'invalid' } : { status: 'not_invite' };
}

function looksLikeContactInviteCandidate(path: string): boolean {
  return (
    /^livecanvas-mobile:(?:\/*invite(?:[/:?#]|$)|\/\/[^/?#]*@invite(?:[/:?#]|$))/i.test(
      path,
    ) ||
    /^https:\/\/[^/?#]*\/invites(?:[?#]|$)/i.test(path)
  );
}

function hasUnexpectedAuthority(parsed: URL): boolean {
  return Boolean(parsed.username || parsed.password || parsed.port);
}

function parseSingleTokenParameters(
  rawParameters: string,
): ParsedContactInviteLink {
  const pairs = rawParameters.split('&');

  if (pairs.length !== 1) {
    return { status: 'invalid' };
  }

  const [rawKey = '', rawValue = '', ...extra] = pairs[0]!.split('=');

  if (
    rawKey !== 'token' ||
    extra.length > 0 ||
    !hasValidPercentEncoding(rawValue)
  ) {
    return { status: 'invalid' };
  }

  try {
    const token = decodeURIComponent(rawValue.replace(/\+/g, ' ')).trim();

    return token ? { status: 'valid', token } : { status: 'invalid' };
  } catch {
    return { status: 'invalid' };
  }
}

function hasValidPercentEncoding(value: string): boolean {
  return !/%(?![0-9A-Fa-f]{2})/.test(value);
}
