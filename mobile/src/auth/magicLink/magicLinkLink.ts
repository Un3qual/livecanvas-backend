export type MagicLinkPurpose = 'signIn' | 'signUp';

export type MagicLinkPayload = {
  readonly purpose: MagicLinkPurpose;
  readonly token: string;
};

export type ParsedMagicLink =
  | { readonly status: 'invalid' }
  | { readonly status: 'not_magic_link' }
  | ({ readonly status: 'valid' } & MagicLinkPayload);

export function redactMagicLinkSnapshotUrl(
  initialUrl: string | null,
  publicAppOrigin: string,
): string | null {
  if (!initialUrl) {
    return initialUrl;
  }

  return parseMagicLink(initialUrl, publicAppOrigin).status ===
    'not_magic_link'
    ? initialUrl
    : '/magic-link';
}

export function parseMagicLink(
  path: string,
  publicAppOrigin: string | null,
): ParsedMagicLink {
  const isCandidate = looksLikeMagicLinkCandidate(path);
  let parsed: URL;

  try {
    parsed = new URL(path);
  } catch {
    return isCandidate ? { status: 'invalid' } : { status: 'not_magic_link' };
  }

  const purpose = purposeFromPath(parsed.pathname);

  if (
    parsed.protocol === 'livecanvas-mobile:' &&
    parsed.hostname === 'magic-link' &&
    purpose
  ) {
    if (
      hasUnexpectedAuthority(parsed) ||
      parsed.hash ||
      !hasExactCustomSchemePrefix(path, parsed.pathname)
    ) {
      return { status: 'invalid' };
    }

    return parseToken(path.slice(path.indexOf('?') + 1), purpose);
  }

  if (
    parsed.protocol === 'https:' &&
    Boolean(parsed.hostname) &&
    purpose
  ) {
    if (
      hasUnexpectedCredentials(parsed) ||
      parsed.search ||
      !matchesPublicAppOrigin(parsed, publicAppOrigin)
    ) {
      return { status: 'invalid' };
    }

    return parseToken(parsed.hash.slice(1), purpose);
  }

  return isCandidate || looksLikeParsedMagicLinkCandidate(parsed)
    ? { status: 'invalid' }
    : { status: 'not_magic_link' };
}

function purposeFromPath(pathname: string): MagicLinkPurpose | null {
  switch (pathname) {
    case '/sign-in':
    case '/auth/magic-link/sign-in':
      return 'signIn';
    case '/sign-up':
    case '/auth/magic-link/sign-up':
      return 'signUp';
    default:
      return null;
  }
}

function parseToken(
  rawParameters: string,
  purpose: MagicLinkPurpose,
): ParsedMagicLink {
  const pairs = rawParameters.split('&');

  if (pairs.length !== 1) {
    return { status: 'invalid' };
  }

  const [pair = ''] = pairs;
  const separatorIndex = pair.indexOf('=');

  if (separatorIndex < 0 || pair.indexOf('=', separatorIndex + 1) >= 0) {
    return { status: 'invalid' };
  }

  const rawKey = pair.slice(0, separatorIndex);
  const rawValue = pair.slice(separatorIndex + 1);

  if (rawKey !== 'token' || !hasValidPercentEncoding(rawValue)) {
    return { status: 'invalid' };
  }

  try {
    const token = decodeURIComponent(rawValue.replace(/\+/g, ' ')).trim();

    return token
      ? { status: 'valid', purpose, token }
      : { status: 'invalid' };
  } catch {
    return { status: 'invalid' };
  }
}

function looksLikeMagicLinkCandidate(path: string): boolean {
  return (
    /^livecanvas-mobile:(?:\/*magic-link(?:[/:?#]|$)|\/\/[^/?#]*@magic-link(?:[/:?#]|$))/i.test(
      path,
    ) || /^https:\/\/[^/?#]*\/auth\/magic-link(?:[/?#]|$)/i.test(path)
  );
}

function looksLikeParsedMagicLinkCandidate(parsed: URL): boolean {
  if (parsed.protocol === 'livecanvas-mobile:') {
    try {
      return decodeURIComponent(parsed.hostname).toLowerCase() === 'magic-link';
    } catch {
      return parsed.hostname.toLowerCase() === 'magic-link';
    }
  }

  if (parsed.protocol !== 'https:') {
    return false;
  }

  try {
    return /^\/auth\/magic-link(?:\/|$)/i.test(
      decodeURIComponent(parsed.pathname),
    );
  } catch {
    return /^\/auth\/magic-link(?:\/|$)/i.test(parsed.pathname);
  }
}

function hasExactCustomSchemePrefix(path: string, pathname: string): boolean {
  return path.startsWith(`livecanvas-mobile://magic-link${pathname}?`);
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

function hasUnexpectedAuthority(parsed: URL): boolean {
  return hasUnexpectedCredentials(parsed) || Boolean(parsed.port);
}

function hasUnexpectedCredentials(parsed: URL): boolean {
  return Boolean(parsed.username || parsed.password);
}

function hasValidPercentEncoding(value: string): boolean {
  return !/%(?![0-9A-Fa-f]{2})/.test(value);
}
