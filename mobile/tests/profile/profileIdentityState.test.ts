import { describe, expect, test } from 'vitest';

import {
  createProfileIdentityState,
  profileIdentityReducer,
  validateProfileIdentity,
} from '../../src/profile/profileIdentityState';

describe('profileIdentityState', () => {
  test('prefills values and canonicalizes a valid submission', () => {
    expect(
      createProfileIdentityState({
        displayName: 'Canvas Creator',
        username: 'canvas_creator',
      }),
    ).toEqual({
      activeAttempt: null,
      confirmed: {
        displayName: 'Canvas Creator',
        username: 'canvas_creator',
      },
      fieldErrors: { displayName: null, username: null },
      generalError: null,
      values: {
        displayName: 'Canvas Creator',
        username: 'canvas_creator',
      },
    });

    expect(
      validateProfileIdentity({
        displayName: '  🎨 Canvas Creator  ',
        username: '  Canvas_Creator  ',
      }),
    ).toEqual({
      fieldErrors: { displayName: null, username: null },
      input: {
        displayName: '🎨 Canvas Creator',
        username: 'canvas_creator',
      },
    });
  });

  test('reports local display-name and handle errors', () => {
    expect(
      validateProfileIdentity({
        displayName: 'Canvas\nCreator',
        username: '_canvas',
      }),
    ).toEqual({
      fieldErrors: {
        displayName: 'Use a single-line display name.',
        username:
          'Use 3-30 letters, numbers, or underscores, starting and ending with a letter or number.',
      },
      input: null,
    });

    expect(
      validateProfileIdentity({ displayName: '  ', username: '  ' }),
    ).toEqual({
      fieldErrors: {
        displayName: 'Enter a display name.',
        username: 'Enter a username.',
      },
      input: null,
    });

    expect(
      validateProfileIdentity({
        displayName: 'a'.repeat(51),
        username: 'a'.repeat(31),
      }).fieldErrors,
    ).toEqual({
      displayName: 'Use a display name with 50 characters or fewer.',
      username:
        'Use 3-30 letters, numbers, or underscores, starting and ending with a letter or number.',
    });
  });

  test('admits one attempt and keeps user edits made while it is active', () => {
    const initial = createProfileIdentityState({
      displayName: 'Old Name',
      username: 'old_name',
    });
    const edited = profileIdentityReducer(
      profileIdentityReducer(initial, {
        field: 'displayName',
        type: 'changed',
        value: 'Submitted Name',
      }),
      { field: 'username', type: 'changed', value: 'SUBMITTED_NAME' },
    );
    const submitting = profileIdentityReducer(edited, {
      attemptId: 7,
      type: 'submitted',
    });

    expect(submitting.activeAttempt).toEqual({
      id: 7,
      input: { displayName: 'Submitted Name', username: 'submitted_name' },
    });
    expect(
      profileIdentityReducer(submitting, {
        attemptId: 8,
        type: 'submitted',
      }),
    ).toBe(submitting);

    const changedWhileSaving = profileIdentityReducer(submitting, {
      field: 'displayName',
      type: 'changed',
      value: 'Unsaved Next Name',
    });
    const succeeded = profileIdentityReducer(changedWhileSaving, {
      attemptId: 7,
      type: 'succeeded',
      values: {
        displayName: 'Submitted Name',
        username: 'submitted_name',
      },
    });

    expect(succeeded.activeAttempt).toBeNull();
    expect(succeeded.confirmed).toEqual({
      displayName: 'Submitted Name',
      username: 'submitted_name',
    });
    expect(succeeded.values).toEqual({
      displayName: 'Unsaved Next Name',
      username: 'SUBMITTED_NAME',
    });
  });

  test('applies canonical success to unchanged inputs and ignores stale completion', () => {
    const submitting = profileIdentityReducer(
      createProfileIdentityState({
        displayName: '  Canvas Creator  ',
        username: 'CANVAS_CREATOR',
      }),
      { attemptId: 10, type: 'submitted' },
    );

    expect(
      profileIdentityReducer(submitting, {
        attemptId: 9,
        type: 'succeeded',
        values: { displayName: 'Stale', username: 'stale' },
      }),
    ).toBe(submitting);

    expect(
      profileIdentityReducer(submitting, {
        attemptId: 10,
        type: 'succeeded',
        values: {
          displayName: 'Canvas Creator',
          username: 'canvas_creator',
        },
      }),
    ).toEqual({
      activeAttempt: null,
      confirmed: {
        displayName: 'Canvas Creator',
        username: 'canvas_creator',
      },
      fieldErrors: { displayName: null, username: null },
      generalError: null,
      values: {
        displayName: 'Canvas Creator',
        username: 'canvas_creator',
      },
    });
  });

  test('maps payload and transport failures, then admits a retry', () => {
    const submitting = profileIdentityReducer(
      createProfileIdentityState({
        displayName: 'Canvas Creator',
        username: 'canvas_creator',
      }),
      { attemptId: 12, type: 'submitted' },
    );
    const failed = profileIdentityReducer(submitting, {
      attemptId: 12,
      errors: [
        { field: 'username', message: 'has already been taken' },
        { field: 'displayName', message: 'is invalid' },
        { field: null, message: 'try again later' },
      ],
      type: 'failed',
    });

    expect(failed).toMatchObject({
      activeAttempt: null,
      fieldErrors: {
        displayName: 'is invalid',
        username: 'has already been taken',
      },
      generalError: 'try again later',
    });

    const retrying = profileIdentityReducer(failed, {
      attemptId: 13,
      type: 'submitted',
    });
    expect(retrying.activeAttempt?.id).toBe(13);
    expect(retrying.fieldErrors).toEqual({ displayName: null, username: null });
    expect(retrying.generalError).toBeNull();

    expect(
      profileIdentityReducer(retrying, {
        attemptId: 13,
        errors: null,
        type: 'failed',
      }).generalError,
    ).toBe('We could not update your profile identity. Try again.');

    expect(
      profileIdentityReducer(retrying, {
        attemptId: 13,
        errors: [{ field: 'username', message: '' }],
        type: 'failed',
      }),
    ).toMatchObject({
      fieldErrors: { displayName: null, username: null },
      generalError: 'We could not update your profile identity. Try again.',
    });
  });

  test('preserves dirty or active inputs across Relay resets', () => {
    const dirty = profileIdentityReducer(
      createProfileIdentityState({
        displayName: 'Old Name',
        username: 'old_name',
      }),
      { field: 'displayName', type: 'changed', value: 'Draft Name' },
    );
    const reset = profileIdentityReducer(dirty, {
      type: 'reset',
      values: { displayName: 'Fresh Name', username: 'fresh_name' },
    });

    expect(reset.confirmed).toEqual({
      displayName: 'Fresh Name',
      username: 'fresh_name',
    });
    expect(reset.values.displayName).toBe('Draft Name');

    const active = profileIdentityReducer(reset, {
      attemptId: 20,
      type: 'submitted',
    });
    expect(
      profileIdentityReducer(active, {
        type: 'reset',
        values: { displayName: 'Ignored', username: 'ignored' },
      }),
    ).toBe(active);
  });
});
