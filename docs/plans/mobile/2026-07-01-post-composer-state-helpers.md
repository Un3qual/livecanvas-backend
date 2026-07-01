# Mobile Post Composer State Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add feed-local pure TypeScript helpers for the text-only mobile post
composer draft, validation, mutation input shaping, and payload error copy.

**Architecture:** Keep Task 1 independent from React, Expo Router, Relay, and
native media handling. The helper module owns draft state and schema enum
mapping so the later screen and mutation tasks can stay mostly presentational.
Use the current backend default of follower visibility as the client default,
but include visibility explicitly when building the create-post input.

**Tech Stack:** TypeScript, Bun tests, Expo mobile source layout, existing
GraphQL enum values from `mobile/schema.graphql`.

---

## Executor Brief

Execute from `docs/plans/mobile/NOW.md`; the active source plan is
`docs/plans/mobile/2026-07-01-mobile-post-composer.md`, Task 1. Write only in
`mobile/**` and `docs/plans/mobile/**` unless a verified backend issue is
promoted separately.

This task creates no route, no screen, no Relay mutation file, no native media
picker, and no signed upload behavior. It should produce a focused, pure helper
module plus tests that later composer UI work can import.

Backend contract notes to preserve:
- `mobile/schema.graphql` exposes `CreatePostKind` as `STANDARD | STORY`.
- `mobile/schema.graphql` exposes `PostVisibility` as `FOLLOWERS | PUBLIC`.
- `lib/live_canvas_gql/content/content_resolver.ex` currently fills omitted
  `visibility` with `:followers`, and the post schema default is also
  `:followers`. Use `FOLLOWERS` as the helper default unless product direction
  changes before implementation.
- `lib/live_canvas/content/post.ex` limits `body_text` to 5000 characters.

## File Structure

- Create `mobile/src/feed/postComposerState.ts`
  - Exports schema-aligned enum constants and types.
  - Creates and updates text-only composer draft state.
  - Validates empty and over-limit text before mutation submission.
  - Builds a trimmed `createPost` input without media IDs.
  - Formats known payload errors into viewer-safe copy.
- Create `mobile/tests/feed/postComposerState.test.ts`
  - Covers default state, empty draft blocking, enum mapping, text trimming,
    over-limit blocking, and payload error formatting.
- Modify `docs/plans/mobile/2026-07-01-mobile-post-composer.md`
  - Only after implementation and verification: check off Task 1 criteria and
    record command evidence.

## Task 1.1: Write The Failing Tests

**Files:**
- Create: `mobile/tests/feed/postComposerState.test.ts`

- [ ] Add the test file with the expected public API before creating the helper.

```ts
import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_POST_COMPOSER_KIND,
  DEFAULT_POST_COMPOSER_VISIBILITY,
  POST_COMPOSER_BODY_TEXT_MAX_LENGTH,
  POST_COMPOSER_KINDS,
  POST_COMPOSER_VISIBILITIES,
  buildCreatePostInput,
  canSubmitPostComposer,
  createPostComposerState,
  formatCreatePostMutationErrors,
  getPostComposerValidationMessage,
  selectPostComposerKind,
  selectPostComposerVisibility,
  updatePostComposerBody,
} from '../../src/feed/postComposerState';

describe('postComposerState', () => {
  test('creates a default followers-visible standard draft and blocks empty submission', () => {
    const initialState = createPostComposerState();

    expect(DEFAULT_POST_COMPOSER_KIND).toBe('STANDARD');
    expect(DEFAULT_POST_COMPOSER_VISIBILITY).toBe('FOLLOWERS');
    expect(POST_COMPOSER_KINDS).toEqual(['STANDARD', 'STORY']);
    expect(POST_COMPOSER_VISIBILITIES).toEqual(['FOLLOWERS', 'PUBLIC']);
    expect(initialState).toEqual({
      bodyText: '',
      errorMessage: null,
      kind: 'STANDARD',
      visibility: 'FOLLOWERS',
    });
    expect(canSubmitPostComposer(initialState)).toBe(false);
    expect(buildCreatePostInput(initialState)).toBeNull();
    expect(getPostComposerValidationMessage(initialState)).toBe(
      'Add text before posting.',
    );

    const filledState = updatePostComposerBody(
      initialState,
      '  first mobile post  ',
    );

    expect(canSubmitPostComposer(filledState)).toBe(true);
    expect(buildCreatePostInput(filledState)).toEqual({
      bodyText: 'first mobile post',
      kind: 'STANDARD',
      visibility: 'FOLLOWERS',
    });
    expect(getPostComposerValidationMessage(filledState)).toBeNull();
  });

  test('maps kind and visibility selections to createPost enum values', () => {
    const storyState = selectPostComposerVisibility(
      selectPostComposerKind(
        updatePostComposerBody(createPostComposerState(), 'story update'),
        'STORY',
      ),
      'PUBLIC',
    );

    expect(buildCreatePostInput(storyState)).toEqual({
      bodyText: 'story update',
      kind: 'STORY',
      visibility: 'PUBLIC',
    });

    expect(selectPostComposerKind(storyState, 'STANDARD').kind).toBe(
      'STANDARD',
    );
    expect(selectPostComposerVisibility(storyState, 'FOLLOWERS').visibility).toBe(
      'FOLLOWERS',
    );
  });

  test('rejects drafts over the backend body length limit', () => {
    const oversizedState = updatePostComposerBody(
      createPostComposerState(),
      'x'.repeat(POST_COMPOSER_BODY_TEXT_MAX_LENGTH + 1),
    );

    expect(canSubmitPostComposer(oversizedState)).toBe(false);
    expect(buildCreatePostInput(oversizedState)).toBeNull();
    expect(getPostComposerValidationMessage(oversizedState)).toBe(
      'Posts must be 5,000 characters or fewer.',
    );
  });

  test('formats known createPost payload errors as viewer-safe copy', () => {
    const examples = [
      {
        errors: [{ field: null, message: 'unauthenticated' }],
        message: 'Sign in again to create a post.',
      },
      {
        errors: [{ field: 'body_text', message: "can't be blank" }],
        message: 'Add text before posting.',
      },
      {
        errors: [
          {
            field: 'body_text',
            message: 'should be at most 5000 character(s)',
          },
        ],
        message: 'Posts must be 5,000 characters or fewer.',
      },
      {
        errors: [{ field: 'kind', message: 'is invalid' }],
        message: 'We could not create this post.',
      },
    ] as const;

    for (const example of examples) {
      expect(formatCreatePostMutationErrors(example.errors)).toBe(
        example.message,
      );
    }

    expect(formatCreatePostMutationErrors([])).toBe(
      'We could not create this post.',
    );
  });
});
```

- [ ] Run the focused test and confirm it fails because the helper file does
      not exist yet.

Run from `mobile/`:

```bash
bun test tests/feed/postComposerState.test.ts
```

Expected result: failure mentioning `../../src/feed/postComposerState` cannot be
resolved.

## Task 1.2: Add The Pure Helper Module

**Files:**
- Create: `mobile/src/feed/postComposerState.ts`

- [ ] Implement the helper module with the API expected by the failing tests.

```ts
export const POST_COMPOSER_KINDS = ['STANDARD', 'STORY'] as const;
export type PostComposerKind = (typeof POST_COMPOSER_KINDS)[number];

export const POST_COMPOSER_VISIBILITIES = ['FOLLOWERS', 'PUBLIC'] as const;
export type PostComposerVisibility =
  (typeof POST_COMPOSER_VISIBILITIES)[number];

export const DEFAULT_POST_COMPOSER_KIND: PostComposerKind = 'STANDARD';
export const DEFAULT_POST_COMPOSER_VISIBILITY: PostComposerVisibility =
  'FOLLOWERS';
export const POST_COMPOSER_BODY_TEXT_MAX_LENGTH = 5000;

export type PostComposerState = {
  readonly bodyText: string;
  readonly errorMessage: string | null;
  readonly kind: PostComposerKind;
  readonly visibility: PostComposerVisibility;
};

export type CreatePostInput = {
  readonly bodyText: string;
  readonly kind: PostComposerKind;
  readonly visibility: PostComposerVisibility;
};

export type CreatePostMutationError = {
  readonly field?: string | null;
  readonly message: string;
};

const EMPTY_BODY_ERROR = 'Add text before posting.';
const BODY_TOO_LONG_ERROR = 'Posts must be 5,000 characters or fewer.';
const CREATE_POST_FALLBACK_ERROR = 'We could not create this post.';
const CREATE_POST_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  unauthenticated: 'Sign in again to create a post.',
};

export function createPostComposerState(): PostComposerState {
  return {
    bodyText: '',
    errorMessage: null,
    kind: DEFAULT_POST_COMPOSER_KIND,
    visibility: DEFAULT_POST_COMPOSER_VISIBILITY,
  };
}

export function updatePostComposerBody(
  state: PostComposerState,
  bodyText: string,
): PostComposerState {
  return {
    ...state,
    bodyText,
    errorMessage: null,
  };
}

export function selectPostComposerKind(
  state: PostComposerState,
  kind: PostComposerKind,
): PostComposerState {
  return {
    ...state,
    errorMessage: null,
    kind,
  };
}

export function selectPostComposerVisibility(
  state: PostComposerState,
  visibility: PostComposerVisibility,
): PostComposerState {
  return {
    ...state,
    errorMessage: null,
    visibility,
  };
}

export function canSubmitPostComposer(state: PostComposerState): boolean {
  return getPostComposerValidationMessage(state) == null;
}

export function buildCreatePostInput(
  state: PostComposerState,
): CreatePostInput | null {
  if (!canSubmitPostComposer(state)) {
    return null;
  }

  return {
    bodyText: state.bodyText.trim(),
    kind: state.kind,
    visibility: state.visibility,
  };
}

export function getPostComposerValidationMessage(
  state: PostComposerState,
): string | null {
  const bodyText = state.bodyText.trim();

  if (!bodyText) {
    return EMPTY_BODY_ERROR;
  }

  if (bodyText.length > POST_COMPOSER_BODY_TEXT_MAX_LENGTH) {
    return BODY_TOO_LONG_ERROR;
  }

  return null;
}

export function formatCreatePostMutationErrors(
  errors: ReadonlyArray<CreatePostMutationError> | null | undefined,
): string {
  const firstKnownMessage = errors?.find((error) =>
    Object.hasOwn(CREATE_POST_ERROR_MESSAGES, error.message),
  )?.message;

  if (firstKnownMessage) {
    return CREATE_POST_ERROR_MESSAGES[firstKnownMessage];
  }

  const bodyError = errors?.find((error) => isBodyTextField(error.field));

  if (bodyError?.message === "can't be blank") {
    return EMPTY_BODY_ERROR;
  }

  if (bodyError?.message.startsWith('should be at most ')) {
    return BODY_TOO_LONG_ERROR;
  }

  return CREATE_POST_FALLBACK_ERROR;
}

function isBodyTextField(field: string | null | undefined): boolean {
  return field === 'bodyText' || field === 'body_text';
}
```

- [ ] Run the focused test again and confirm it passes.

Run from `mobile/`:

```bash
bun test tests/feed/postComposerState.test.ts
```

Expected result: all tests in `postComposerState.test.ts` pass.

## Task 1.3: Record Task Evidence And Commit

**Files:**
- Modify: `docs/plans/mobile/2026-07-01-mobile-post-composer.md`

- [ ] In the source plan, check off Task 1 acceptance criteria and add a short
      evidence note with the focused test command and result.
- [ ] From repo root, run whitespace verification.

```bash
git diff --check
```

Expected result: no output and exit code 0.

- [ ] Commit the completed Task 1 milestone.

```bash
git add mobile/src/feed/postComposerState.ts \
  mobile/tests/feed/postComposerState.test.ts \
  docs/plans/mobile/2026-07-01-mobile-post-composer.md
git commit -m "Add mobile post composer state helpers"
```

Do not include screen, route, Relay mutation, generated Relay artifacts, backend
code, or shared coordinator docs in this Task 1 commit.

## Handoff

After this plan is implemented, the next executable batch remains in
`docs/plans/mobile/2026-07-01-mobile-post-composer.md`, Task 2: add the
composer route and screen.
