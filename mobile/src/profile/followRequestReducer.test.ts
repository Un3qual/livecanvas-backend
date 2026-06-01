import { describe, expect, test } from 'bun:test';

import {
  createFollowRequestState,
  followRequestReducer,
  isFollowRequestDismissed,
} from './followRequestReducer';

describe('followRequestReducer', () => {
  test('starts one active accept action', () => {
    expect(
      followRequestReducer(createFollowRequestState(), {
        action: 'accept',
        requestId: 'request-1',
        type: 'start',
      }),
    ).toEqual({
      activeAction: { action: 'accept', requestId: 'request-1' },
      dismissedRequestIds: {},
      errorsByRequestId: {},
    });
  });

  test('ignores a second action while another request is active', () => {
    const state = followRequestReducer(createFollowRequestState(), {
      action: 'accept',
      requestId: 'request-1',
      type: 'start',
    });

    expect(
      followRequestReducer(state, {
        action: 'decline',
        requestId: 'request-2',
        type: 'start',
      }),
    ).toBe(state);
  });

  test('dismisses a successful row', () => {
    const state = followRequestReducer(createFollowRequestState(), {
      action: 'decline',
      requestId: 'request-1',
      type: 'start',
    });

    const next = followRequestReducer(state, {
      requestId: 'request-1',
      type: 'success',
    });

    expect(isFollowRequestDismissed(next, 'request-1')).toBe(true);
    expect(next.activeAction).toBeNull();
  });

  test('preserves row-level errors after a failed action', () => {
    const state = followRequestReducer(createFollowRequestState(), {
      action: 'accept',
      requestId: 'request-1',
      type: 'start',
    });

    expect(
      followRequestReducer(state, {
        message: 'followerId: not_found',
        requestId: 'request-1',
        type: 'error',
      }),
    ).toEqual({
      activeAction: null,
      dismissedRequestIds: {},
      errorsByRequestId: {
        'request-1': 'followerId: not_found',
      },
    });
  });
});
