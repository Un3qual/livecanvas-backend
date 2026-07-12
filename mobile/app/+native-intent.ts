import { redirectContactInviteSystemPath } from '../src/contacts/contactInviteLink';
import { resolveEnvironment } from '../src/config/environment';

export function redirectSystemPath({ path }: {
  readonly initial: boolean;
  readonly path: string;
}): Promise<string> {
  let publicAppOrigin: string | null = null;

  try {
    publicAppOrigin = resolveEnvironment().publicAppOrigin;
  } catch {
    // Invite-shaped HTTPS links fail closed below when deploy-time config is invalid.
  }

  return redirectContactInviteSystemPath(path, publicAppOrigin);
}
