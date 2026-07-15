import { storeMagicLinkHandoff } from './magicLinkHandoff';
import { parseMagicLink } from './magicLinkLink';

export async function redirectMagicLinkSystemPath(
  path: string,
  publicAppOrigin: string | null,
): Promise<string> {
  const parsed = parseMagicLink(path, publicAppOrigin);

  if (parsed.status === 'not_magic_link') {
    return path;
  }

  if (parsed.status === 'invalid') {
    return '/magic-link';
  }

  try {
    const { handoffId } = await storeMagicLinkHandoff({
      purpose: parsed.purpose,
      token: parsed.token,
    });
    return `/magic-link?handoff=${encodeURIComponent(handoffId)}`;
  } catch {
    return '/magic-link';
  }
}
