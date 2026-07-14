import { describe, expect, test } from 'vitest';

import {
  DEFAULT_REPORT_POST_REASON,
  REPORT_POST_REASONS,
  canSubmitPostReport,
  createReportPostState,
  formatReportPostMutationErrors,
  isPostReportConfirmed,
  reportPostReducer,
} from '../../src/content/reportPostReducer';

describe('reportPostReducer', () => {
  test('tracks one active post report and blocks duplicate submissions', () => {
    const initialState = createReportPostState();

    expect(DEFAULT_REPORT_POST_REASON).toBe('SPAM');
    expect(REPORT_POST_REASONS).toEqual([
      'SPAM',
      'HARASSMENT',
      'HATE',
      'VIOLENCE',
      'SEXUAL_CONTENT',
      'SELF_HARM',
      'ILLEGAL',
      'OTHER',
    ]);
    expect(canSubmitPostReport(initialState, 'post-1')).toBe(true);

    const submittingState = reportPostReducer(initialState, {
      postId: 'post-1',
      type: 'start',
    });

    expect(submittingState.activePostId).toBe('post-1');
    expect(canSubmitPostReport(submittingState, 'post-1')).toBe(false);

    const duplicateStartState = reportPostReducer(submittingState, {
      postId: 'post-1',
      type: 'start',
    });

    expect(duplicateStartState).toBe(submittingState);
  });

  test('confirms successful reports without removing retryable errors for other posts', () => {
    const failedState = reportPostReducer(createReportPostState(), {
      message: 'This post is no longer available.',
      postId: 'post-2',
      type: 'error',
    });
    const submittingState = reportPostReducer(failedState, {
      postId: 'post-1',
      type: 'start',
    });
    const confirmedState = reportPostReducer(submittingState, {
      postId: 'post-1',
      type: 'success',
    });

    expect(confirmedState.activePostId).toBeNull();
    expect(isPostReportConfirmed(confirmedState, 'post-1')).toBe(true);
    expect(canSubmitPostReport(confirmedState, 'post-1')).toBe(false);
    expect(confirmedState.errorsByPostId['post-2']).toBe(
      'This post is no longer available.',
    );
  });

  test('formats known payload errors as viewer-safe retryable copy', () => {
    const examples = [
      {
        errors: [{ field: 'postId', message: 'own_post' }],
        message: 'You cannot report your own post.',
      },
      {
        errors: [{ field: 'postId', message: 'not_found' }],
        message: 'This post is no longer available.',
      },
      {
        errors: [{ field: null, message: 'unauthenticated' }],
        message: 'Sign in again to report this post.',
      },
      {
        errors: [{ field: 'postId', message: 'invalid_type' }],
        message: 'We could not report this post.',
      },
    ] as const;

    for (const example of examples) {
      expect(formatReportPostMutationErrors(example.errors)).toBe(
        example.message,
      );
    }

    expect(formatReportPostMutationErrors([])).toBe(
      'We could not report this post.',
    );
  });
});
