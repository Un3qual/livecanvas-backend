# Mobile Post Composer Relay Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Submit text-only standard posts and stories from `/compose` through
the existing Relay `createPost` mutation.

**Architecture:** Keep the GraphQL document in a feed-local operations file and
let `PostComposerScreen` own mutation state, duplicate-submit protection, and
viewer-safe payload errors. Preserve the existing pure composer state helpers
for validation and input shaping; add no backend/schema changes unless Relay
codegen proves a contract mismatch. On success, show `Post created.` and
replace the route with `/home`.

**Tech Stack:** Expo Router, React Native, Relay `useMutation`, feed-local
composer helpers, Bun tests, Relay compiler.

---

## Executor Brief

Execute from `docs/plans/mobile/NOW.md`; the active source plan is
`docs/plans/mobile/2026-07-01-mobile-post-composer.md`, Task 3. Task 1 created
`mobile/src/feed/postComposerState.ts`; Task 2 created the `/compose` route and
temporary screen submit callback.

This task wires only text post creation:
- No backend Elixir, schema, or shared contract changes unless a verified
  mismatch is promoted into the backend lane.
- No native media picker, `requestMediaUpload`, signed upload, or media
  attachment UI.
- No Relay ID decoding client-side.
- No release-candidate device QA or remote/authenticated EAS commands.
- Keep mobile tests under `mobile/tests/**`.

Use the existing backend contract from `mobile/schema.graphql`:
`createPost(input: CreatePostInput!): CreatePostPayload`, where
`CreatePostPayload` returns `post` and `errors { field message }`.

## File Structure

- Create `mobile/src/feed/postComposerOperations.ts`
  - Export `postComposerCreatePostMutation`.
  - Re-export the generated Relay mutation type as
    `PostComposerCreatePostMutation`.
- Modify `mobile/src/feed/PostComposerScreen.tsx`
  - Replace the optional `onSubmitInput` test callback with Relay
    `useMutation`.
  - Use a `useRef(false)` guard in addition to Relay in-flight state so two
    same-render taps cannot enqueue duplicate mutations.
  - Show payload or network errors without clearing `state.bodyText`.
  - Show `Post created.` and call `router.replace('/home')` on successful
    payloads.
- Modify `mobile/tests/feed/PostComposerScreen.test.tsx`
  - Mock `react-relay` and assert the mutation contract, duplicate-tap guard,
    success navigation, and retryable payload errors.
  - Extend the lightweight hook dispatcher with `useRef`.
- Modify after codegen:
  `mobile/src/__generated__/postComposerOperationsCreatePostMutation.graphql.ts`.
- Update after implementation:
  `docs/plans/mobile/2026-07-01-mobile-post-composer.md` and
  `docs/plans/mobile/NOW.md`.

## Task 3.1: Write Failing Relay Submission Tests

**Files:**
- Modify: `mobile/tests/feed/PostComposerScreen.test.tsx`

- [ ] Replace the `onSubmitInput`-based submit test with Relay mutation tests.
      Keep the existing route, validation, selection accessibility, and cancel
      tests.

Required test harness changes:
- Add `replaceCalls: string[]` next to `backCalls`.
- Make the `expo-router` mock return both:

```ts
useRouter: () => ({
  back: () => {
    backCalls.push('back');
  },
  replace: (route: string) => {
    replaceCalls.push(route);
  },
})
```

- Add `useRef` to the `HookDispatcher` and `renderWithHooks` dispatcher:

```ts
type HookDispatcher = {
  useRef: <Value>(initialValue: Value) => { current: Value };
  useState: <State>(
    initialState: State | (() => State),
  ) => [State, (nextState: State | ((current: State) => State)) => void];
};
```

Implementation shape for `useRef` in the dispatcher:

```ts
useRef: <Value,>(initialValue: Value): { current: Value } => {
  const currentIndex = hookIndex;

  if (hookStates.length === currentIndex) {
    hookStates.push({ current: initialValue });
  }

  hookIndex += 1;

  return hookStates[currentIndex] as { current: Value };
},
```

- Mock `react-relay`:

```ts
type CreatePostCommitConfig = {
  onCompleted?: (payload: unknown) => void;
  onError?: () => void;
  variables: unknown;
};

let createPostInFlight = false;
let createPostCommitCalls: CreatePostCommitConfig[];

mock.module('react-relay', () => ({
  graphql: (query: TemplateStringsArray) => query,
  useMutation: () => [
    (config: CreatePostCommitConfig) => {
      createPostCommitCalls.push(config);
    },
    createPostInFlight,
  ],
}));
```

- Reset `replaceCalls`, `createPostInFlight`, and `createPostCommitCalls` in
  `beforeEach`.

Required test cases:
- `commits createPost with trimmed input values`
  - Enter `  Story update  `.
  - Press `Story`, press `Public`, press `Post`.
  - Assert the first commit variables equal:

```ts
{
  input: {
    bodyText: 'Story update',
    kind: 'STORY',
    visibility: 'PUBLIC',
  },
}
```

- `blocks duplicate createPost submissions before rerender`
  - Enter `Duplicate guard`.
  - Press `Post` twice on the same rendered tree.
  - Assert `createPostCommitCalls` has length `1`.

- `shows confirmation and returns home after successful creation`
  - Submit a valid post.
  - Call `createPostCommitCalls[0].onCompleted?.(...)` with:

```ts
{
  createPost: {
    post: { id: 'post-1' },
    errors: [],
  },
}
```

  - Rerender and assert collected text includes `Post created.`.
  - Assert `replaceCalls` equals `['/home']`.

- `keeps payload errors retryable without losing the draft body`
  - Enter `Retry this post`.
  - Press `Post`.
  - Complete with:

```ts
{
  createPost: {
    post: null,
    errors: [{ field: null, message: 'unauthenticated' }],
  },
}
```

  - Rerender and assert collected text includes
    `Sign in again to create a post.`.
  - Assert the body input value is still `Retry this post`.
  - Assert `Post` is enabled.
  - Press `Post` again and assert `createPostCommitCalls` has length `2`.

- [ ] Run the focused screen test and confirm it fails before implementation.

Run from `mobile/`:

```bash
bun test tests/feed/PostComposerScreen.test.tsx
```

Expected result: failure because `react-relay` is not used by
`PostComposerScreen` yet and `mobile/src/feed/postComposerOperations.ts` does
not exist.

## Task 3.2: Add The CreatePost Relay Operation

**Files:**
- Create: `mobile/src/feed/postComposerOperations.ts`

- [ ] Add the feed-local operation file.

```ts
import { graphql } from 'react-relay';

export type {
  postComposerOperationsCreatePostMutation as PostComposerCreatePostMutation,
} from '../__generated__/postComposerOperationsCreatePostMutation.graphql';

export const postComposerCreatePostMutation = graphql`
  mutation postComposerOperationsCreatePostMutation(
    $input: CreatePostInput!
  ) {
    createPost(input: $input) {
      post {
        id
        kind
        bodyText
        visibility
        expiresAt
        insertedAt
        author {
          id
          email
        }
        mediaAssets {
          id
          mimeType
          processingState
          publicUrl
        }
      }
      errors {
        field
        message
      }
    }
  }
`;
```

- [ ] Run Relay codegen.

Run from `mobile/`:

```bash
bun run relay
```

Expected result: Relay generates
`mobile/src/__generated__/postComposerOperationsCreatePostMutation.graphql.ts`
without schema errors.

## Task 3.3: Wire PostComposerScreen To Relay

**Files:**
- Modify: `mobile/src/feed/PostComposerScreen.tsx`

- [ ] Import `useRef`, `useMutation`, the operation, generated mutation type,
      and `formatCreatePostMutationErrors`.

Required import changes:

```ts
import { useRef, useState } from 'react';
import { useMutation } from 'react-relay';
```

```ts
import {
  postComposerCreatePostMutation,
  type PostComposerCreatePostMutation,
} from './postComposerOperations';
```

- [ ] Remove `PostComposerScreenProps` and the `onSubmitInput` callback path.
      The screen should submit through Relay only.

- [ ] Add mutation state inside `PostComposerScreen`:

```ts
const activeCreatePostRef = useRef(false);
const [successMessage, setSuccessMessage] = useState<string | null>(null);
const [commitCreatePost, isCreatePostInFlight] =
  useMutation<PostComposerCreatePostMutation>(
    postComposerCreatePostMutation,
  );
const isSubmitting = isCreatePostInFlight || activeCreatePostRef.current;
const visibleMessage =
  state.errorMessage ??
  (shouldShowValidation ? validationMessage : null);
```

- [ ] Update body, kind, and visibility handlers to clear `successMessage` when
      the draft changes.

- [ ] Replace `handleSubmit` with a mutation-backed handler:

```ts
function handleSubmit() {
  if (isSubmitting) {
    return;
  }

  const input = buildCreatePostInput(state);

  if (input === null) {
    setSubmitAttempted(true);
    return;
  }

  setSubmitAttempted(true);
  setSuccessMessage(null);
  activeCreatePostRef.current = true;
  commitCreatePost({
    variables: { input },
    onCompleted: (payload) => {
      activeCreatePostRef.current = false;
      const result = payload.createPost;

      if (!result?.post || result.errors.length > 0) {
        setState((current) => ({
          ...current,
          errorMessage: formatCreatePostMutationErrors(result?.errors),
        }));
        return;
      }

      setState(createPostComposerState());
      setBodyBlurred(false);
      setSuccessMessage('Post created.');
      router.replace('/home');
    },
    onError: () => {
      activeCreatePostRef.current = false;
      setState((current) => ({
        ...current,
        errorMessage: formatCreatePostMutationErrors(null),
      }));
    },
  });
}
```

- [ ] Render `visibleMessage` and `successMessage` with ternaries, not leaked
      `&&` conditionals:

```tsx
{visibleMessage ? (
  <Text style={[styles.validation, { color: theme.colors.error }]}>
    {visibleMessage}
  </Text>
) : null}
{successMessage ? (
  <Text style={[styles.validation, { color: theme.colors.accent }]}>
    {successMessage}
  </Text>
) : null}
```

- [ ] Disable the `Post` button while invalid or submitting:

```tsx
<AppButton
  disabled={!canSubmit || isSubmitting}
  label={isSubmitting ? 'Posting...' : 'Post'}
  onPress={handleSubmit}
  variant="primary"
/>
```

## Task 3.4: Prove Focused Tests Pass

**Files:**
- Modify if needed: `mobile/tests/feed/PostComposerScreen.test.tsx`
- Modify if generated: `mobile/src/__generated__/postComposerOperationsCreatePostMutation.graphql.ts`

- [ ] Run the focused screen test.

Run from `mobile/`:

```bash
bun test tests/feed/PostComposerScreen.test.tsx
```

Expected result: all `PostComposerScreen` tests pass.

- [ ] Run Relay codegen again after the screen imports settle.

Run from `mobile/`:

```bash
bun run relay
```

Expected result: no Relay compiler changes beyond the generated
`postComposerOperationsCreatePostMutation` artifact.

## Task 3.5: Record Task Evidence

**Files:**
- Modify: `docs/plans/mobile/2026-07-01-mobile-post-composer.md`
- Modify: `docs/plans/mobile/NOW.md`

- [ ] In the source plan, check off Task 3 acceptance criteria only after the
      focused tests and Relay codegen pass:
  - Submit calls `createPost(input: {kind, bodyText, visibility})`.
  - Duplicate taps cannot start duplicate create mutations.
  - Successful creation shows confirmation and returns the viewer to `/home`.
  - Payload errors remain retryable without losing the draft body.

- [ ] Add evidence under Task 3:

```md
Evidence:
- 2026-07-01: From `mobile/`,
  `bun test tests/feed/PostComposerScreen.test.tsx` -> [exact pass count].
- 2026-07-01: From `mobile/`, `bun run relay` -> passed.
```

- [ ] Advance `docs/plans/mobile/NOW.md` only if Task 3 is complete. The next
      current task should be Task 4, final verification and lane evidence.

## Task 3.6: Commit The Completed Task

**Files:**
- Stage only Task 3 code, generated Relay artifact, focused test changes, and
  lane plan evidence.

- [ ] Check whitespace.

Run from repo root:

```bash
git diff --check
```

Expected result: no output.

- [ ] Commit the Task 3 milestone.

```bash
git add mobile/src/feed/postComposerOperations.ts \
  mobile/src/feed/PostComposerScreen.tsx \
  mobile/src/__generated__/postComposerOperationsCreatePostMutation.graphql.ts \
  mobile/tests/feed/PostComposerScreen.test.tsx \
  docs/plans/mobile/2026-07-01-mobile-post-composer.md \
  docs/plans/mobile/NOW.md
git commit -m "Wire mobile post composer create mutation"
```

## Verification For This Task

Minimum verification before claiming Task 3 complete:

```bash
cd mobile
bun test tests/feed/PostComposerScreen.test.tsx
bun run relay
cd ..
git diff --check
```

Run the broader lane gates in Task 4, not as a substitute for the focused Task
3 checks:

```bash
cd mobile
bun test tests/feed/postComposerState.test.ts
bun test tests/feed/PostComposerScreen.test.tsx tests/feed/FeedHomeScreen.test.tsx
bun run typecheck
bun run test:quality
```

## Self-Review

- Spec coverage: every Task 3 source-plan criterion maps to a focused test and
  implementation step above.
- Placeholder scan: no deferred implementation or unspecified error handling is
  left for the executor.
- Type consistency: operation, generated type export, screen import, and test
  mutation names all use `postComposerOperationsCreatePostMutation`.
