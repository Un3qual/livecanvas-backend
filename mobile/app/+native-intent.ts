import { redirectContactInviteSystemPath } from '../src/contacts/contactInviteLink';

export function redirectSystemPath({ path }: {
  readonly initial: boolean;
  readonly path: string;
}): Promise<string> {
  return redirectContactInviteSystemPath(path);
}
