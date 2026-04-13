import { describe, expect, test } from 'bun:test';

import { createAuthSubmissionGate } from './authSubmissionGate';

describe('createAuthSubmissionGate', () => {
  test('serializes auth submissions until the active request settles', async () => {
    const gate = createAuthSubmissionGate();
    let releaseFirstSubmission: (() => void) | undefined;

    const firstStarted = gate.begin();

    expect(firstStarted).toBe(true);
    expect(gate.isActive()).toBe(true);
    expect(gate.begin()).toBe(false);

    const firstCompletion = new Promise<void>((resolve) => {
      releaseFirstSubmission = resolve;
    }).finally(() => {
      gate.end();
    });

    releaseFirstSubmission?.();
    await firstCompletion;

    expect(gate.isActive()).toBe(false);
    expect(gate.begin()).toBe(true);
    gate.end();
  });
});
