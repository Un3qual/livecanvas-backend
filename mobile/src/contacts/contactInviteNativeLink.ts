import { storeContactInviteHandoff } from './contactInviteHandoff';
import { parseContactInviteLink } from './contactInviteLink';

export async function redirectContactInviteSystemPath(
  path: string,
  publicAppOrigin: string | null,
): Promise<string> {
  const parsed = parseContactInviteLink(path, publicAppOrigin);

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
