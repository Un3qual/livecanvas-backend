export type ParsedContactInviteLink =
  | { readonly status: 'invalid' }
  | { readonly status: 'not_invite' }
  | { readonly status: 'valid'; readonly token: string };

export function redactContactInviteSnapshotUrl(
  initialUrl: string | null,
  publicAppOrigin: string,
): string | null {
  if (!initialUrl) {
    return initialUrl;
  }

  return parseContactInviteLink(initialUrl, publicAppOrigin).status === 'not_invite'
    ? initialUrl
    : '/invite';
}

export function parseContactInviteLink(
  path: string,
  publicAppOrigin: string | null,
): ParsedContactInviteLink {
  const isInviteCandidate = looksLikeContactInviteCandidate(path);
  let parsed: URL;

  try {
    parsed = new URL(path);
  } catch {
    return isInviteCandidate
      ? { status: 'invalid' }
      : { status: 'not_invite' };
  }

  const parsedHttpsInviteCandidate = looksLikeParsedHttpsInviteCandidate(parsed);
  const parsedCustomInviteCandidate =
    looksLikeParsedCustomInviteCandidate(parsed);

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
    if (
      hasUnexpectedCredentials(parsed) ||
      parsed.search ||
      !matchesPublicAppOrigin(parsed, publicAppOrigin)
    ) {
      return { status: 'invalid' };
    }

    return parseSingleTokenParameters(parsed.hash.slice(1));
  }

  return isInviteCandidate || parsedCustomInviteCandidate || parsedHttpsInviteCandidate
    ? { status: 'invalid' }
    : { status: 'not_invite' };
}

function matchesPublicAppOrigin(
  parsed: URL,
  publicAppOrigin: string | null,
): boolean {
  if (!publicAppOrigin) {
    return false;
  }

  try {
    return parsed.origin === new URL(publicAppOrigin).origin;
  } catch {
    return false;
  }
}

function looksLikeContactInviteCandidate(path: string): boolean {
  return (
    /^livecanvas-mobile:(?:\/*invite(?:[/:?#]|$)|\/\/[^/?#]*@invite(?:[/:?#]|$))/i.test(
      path,
    ) ||
    /^https:\/\/[^/?#]*\/invites(?:[?#]|$)/i.test(path)
  );
}

function looksLikeParsedHttpsInviteCandidate(parsed: URL): boolean {
  if (parsed.protocol !== 'https:') {
    return false;
  }

  try {
    return /^\/invites(?:\/|$)/i.test(decodeURIComponent(parsed.pathname));
  } catch {
    return /^\/invites(?:\/|$)/i.test(parsed.pathname);
  }
}

function looksLikeParsedCustomInviteCandidate(parsed: URL): boolean {
  if (parsed.protocol !== 'livecanvas-mobile:') {
    return false;
  }

  try {
    return decodeURIComponent(parsed.hostname).toLowerCase() === 'invite';
  } catch {
    return parsed.hostname.toLowerCase() === 'invite';
  }
}

function hasUnexpectedAuthority(parsed: URL): boolean {
  return hasUnexpectedCredentials(parsed) || Boolean(parsed.port);
}

function hasUnexpectedCredentials(parsed: URL): boolean {
  return Boolean(parsed.username || parsed.password);
}

function parseSingleTokenParameters(
  rawParameters: string,
): ParsedContactInviteLink {
  const pairs = rawParameters.split('&');

  if (pairs.length !== 1) {
    return { status: 'invalid' };
  }

  const [pair = ''] = pairs;
  const [rawKey = '', rawValue = '', ...extra] = pair.split('=');

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
