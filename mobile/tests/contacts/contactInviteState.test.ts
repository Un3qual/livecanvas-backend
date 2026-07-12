import { describe, expect, test } from 'bun:test';

import {
  contactInviteStateReducer,
  createContactInviteState,
  readContactInviteHandoffParam,
} from '../../src/contacts/contactInviteState';

describe('contact invite state', () => {
  test('accepts one opaque handoff route param and rejects arrays or malformed IDs', () => {
    expect(readContactInviteHandoffParam('handoff-one')).toBe('handoff-one');
    expect(readContactInviteHandoffParam(['handoff-one'])).toBeNull();
    expect(readContactInviteHandoffParam('')).toBeNull();
    expect(readContactInviteHandoffParam('raw token')).toBeNull();
  });

  test('renders exactly the six public lifecycle states', () => {
    const statuses = [
      'checking',
      'requires_auth',
      'consuming',
      'consumed',
      'invalid',
      'retryable_error',
    ];

    expect(statuses).toEqual([
      createContactInviteState('handoff-a').status,
      contactInviteStateReducer(createContactInviteState('handoff-a'), {
        attemptId: 1,
        handoffId: 'handoff-a',
        type: 'requires_auth',
      }).status,
      contactInviteStateReducer(createContactInviteState('handoff-a'), {
        attemptId: 1,
        handoffId: 'handoff-a',
        type: 'consuming',
      }).status,
      contactInviteStateReducer(
        { handoffId: 'handoff-a', attemptId: 1, status: 'consuming' },
        { attemptId: 1, handoffId: 'handoff-a', type: 'consumed' },
      ).status,
      contactInviteStateReducer(createContactInviteState('handoff-a'), {
        attemptId: 1,
        handoffId: 'handoff-a',
        type: 'invalid',
      }).status,
      contactInviteStateReducer(
        { handoffId: 'handoff-a', attemptId: 1, status: 'consuming' },
        {
          attemptId: 1,
          handoffId: 'handoff-a',
          type: 'retryable_error',
        },
      ).status,
    ]);
  });

  test('ignores stale callbacks after a newer attempt starts', () => {
    const consuming = contactInviteStateReducer(
      { handoffId: 'handoff-a', attemptId: 1, status: 'retryable_error' },
      { attemptId: 2, handoffId: 'handoff-a', type: 'consuming' },
    );

    expect(
      contactInviteStateReducer(consuming, {
        attemptId: 1,
        handoffId: 'handoff-a',
        type: 'consumed',
      }),
    ).toEqual(consuming);
  });

  test('resets checking state when invite B replaces invite A', () => {
    const state = contactInviteStateReducer(
      { handoffId: 'handoff-a', attemptId: 1, status: 'consuming' },
      { handoffId: 'handoff-b', type: 'route_changed' },
    );

    expect(state).toEqual({
      attemptId: null,
      handoffId: 'handoff-b',
      status: 'checking',
    });
    expect(
      contactInviteStateReducer(state, {
        attemptId: 1,
        handoffId: 'handoff-a',
        type: 'invalid',
      }),
    ).toEqual(state);
  });

  test('starts a new consuming attempt after retryable transport failure', () => {
    const failed = contactInviteStateReducer(
      { handoffId: 'handoff-a', attemptId: 1, status: 'consuming' },
      {
        attemptId: 1,
        handoffId: 'handoff-a',
        type: 'retryable_error',
      },
    );

    expect(
      contactInviteStateReducer(failed, {
        attemptId: 2,
        handoffId: 'handoff-a',
        type: 'consuming',
      }),
    ).toEqual({
      attemptId: 2,
      handoffId: 'handoff-a',
      status: 'consuming',
    });
  });
});
