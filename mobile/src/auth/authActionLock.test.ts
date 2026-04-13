import { describe, expect, test } from 'bun:test';

import { createAuthActionLock } from './authActionLock';

describe('createAuthActionLock', () => {
  test('blocks concurrent actions until the active request settles', async () => {
    const actionLock = createAuthActionLock();
    let resolveFirstAction: ((value: boolean) => void) | undefined;

    expect(actionLock.isLocked()).toBe(false);

    const firstAction = actionLock.run(
      () =>
        new Promise<boolean>((resolve) => {
          resolveFirstAction = resolve;
        }),
    );

    expect(actionLock.isLocked()).toBe(true);
    expect(await actionLock.run(async () => true)).toBe(false);

    resolveFirstAction?.(true);

    expect(await firstAction).toBe(true);
    expect(actionLock.isLocked()).toBe(false);
    expect(await actionLock.run(async () => true)).toBe(true);
  });
});
