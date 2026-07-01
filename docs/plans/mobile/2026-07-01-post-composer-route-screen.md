# Mobile Post Composer Route And Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Expo Router `/compose` route and a text-only post composer
screen reachable from the mobile home surface.

**Architecture:** Keep `mobile/app/(app)/compose.tsx` as a thin route wrapper
and put all UI state in `mobile/src/feed/PostComposerScreen.tsx`. Reuse the
Task 1 `postComposerState` helpers for kind selection, validation, and future
mutation input shaping, but do not create Relay operations or generated files
until Task 3. Extend the existing home action model with a compose action that
uses `router.push('/compose')`.

**Tech Stack:** Expo Router, React Native, existing shell primitives
`AppHeader`, `AppCard`, `AppButton`, `ScreenState`, feed-local TypeScript
helpers, Bun tests.

---

## Executor Brief

Execute from `docs/plans/mobile/NOW.md`; the active source plan is
`docs/plans/mobile/2026-07-01-mobile-post-composer.md`, Task 2. Task 1 is
complete, so import from `mobile/src/feed/postComposerState.ts` instead of
rewriting those helpers.

This task is a navigable UI shell only:
- No backend Elixir or GraphQL schema changes.
- No `createPost` Relay mutation file.
- No Relay compiler or generated artifact changes.
- No native media picker, upload request, or media attachment UI.
- No release-candidate manual QA.

The screen may expose a narrow optional submit callback for focused tests, but
the real mutation behavior belongs to Task 3. Do not show a success message or
claim a post was created in Task 2.

## File Structure

- Create `mobile/app/(app)/compose.tsx`
  - Default-export a route component that renders `PostComposerScreen`.
  - Keep the route file free of composer state, styles, Relay, and helper
    functions.
- Create `mobile/src/feed/PostComposerScreen.tsx`
  - Render a scrollable composer screen using existing app primitives.
  - Own local draft state, validation display, kind and visibility selection,
    submit affordance, and cancel/back behavior.
  - Use `useRouter().back()` for cancel.
  - Use `buildCreatePostInput`, `canSubmitPostComposer`,
    `createPostComposerState`, `getPostComposerValidationMessage`,
    `POST_COMPOSER_KINDS`, `POST_COMPOSER_VISIBILITIES`,
    `selectPostComposerKind`, `selectPostComposerVisibility`, and
    `updatePostComposerBody`.
- Modify `mobile/src/feed/FeedHomeScreen.tsx`
  - Add a compose action to the existing home action list.
  - Extend the feed action route type to include `/compose`.
- Create `mobile/tests/feed/PostComposerScreen.test.tsx`
  - Test route delegation, initial disabled state, text entry, kind and
    visibility selection, validation, valid submit callback input, and cancel
    back navigation.
- Modify `mobile/tests/feed/FeedHomeScreen.test.tsx`
  - Update the action helper expectations.
  - Assert pressing `Create post` pushes `/compose`.
- Modify `docs/plans/mobile/2026-07-01-mobile-post-composer.md`
  - After implementation, check off Task 2 criteria and record focused test
    evidence.
- Modify `docs/plans/mobile/NOW.md`
  - After implementation, advance the current task only if Task 2 is complete.

## Task 2.1: Write Failing Screen And Route Tests

**Files:**
- Create: `mobile/tests/feed/PostComposerScreen.test.tsx`

- [ ] Add a focused test file before creating the route or screen. Use the same
      lightweight React element renderer style already present in
      `mobile/tests/feed/FeedHomeScreen.test.tsx`; keep this test
      self-contained and do not extract a shared harness in this task.

Required mocks:
- `expo-router`: `useRouter` returns `{ back: () => backCalls.push('back') }`.
- `react-native`: host mocks for `Pressable`, `ScrollView`, `StyleSheet`,
  `Text`, `TextInput`, and `View`.
- `../../src/components/AppButton`: render a host `Pressable` with
  `accessibilityRole="button"`, `disabled`, `onPress`, and the label as text.
- `../../src/components/AppCard`: render a host `View`.
- `../../src/components/AppHeader`: render a host `View` containing eyebrow,
  title, and subtitle.
- `../../src/components/ScreenState`: render a host `View` containing state and
  message.
- `../../src/providers/ThemeProvider` and `../../src/theme/tokens`: match the
  token and theme shape used by `FeedHomeScreen.test.tsx`.

Required test cases:
- `keeps compose route pointed at the post composer screen`
  - Import `../../app/(app)/compose`.
  - Render the default export.
  - Assert collected text includes `Compose post`, `Standard`, `Story`, `Post`,
    and `Cancel`.
- `keeps submit disabled until the body is valid`
  - Render `PostComposerScreen`.
  - Assert the `Post` button is disabled initially.
  - Find the host `TextInput` by `accessibilityLabel: 'Post body'`.
  - Call `onChangeText('  hello from mobile  ')`, rerender, and assert `Post`
    is enabled.
  - Call `onChangeText('x'.repeat(5001))`, rerender, and assert collected text
    includes `Posts must be 5,000 characters or fewer.` and `Post` is disabled.
- `maps kind and visibility controls to createPost input values`
  - Render `PostComposerScreen` with an `onSubmitInput` test callback.
  - Enter `Story update`, press `Story`, press `Public`, then press `Post`.
  - Assert callback input equals:

```ts
{
  bodyText: 'Story update',
  kind: 'STORY',
  visibility: 'PUBLIC',
}
```

- `cancels through router back`
  - Press `Cancel`.
  - Assert `backCalls` equals `['back']`.

- [ ] Run the focused test and confirm it fails before implementation.

Run from `mobile/`:

```bash
bun test tests/feed/PostComposerScreen.test.tsx
```

Expected result: failure because `../../src/feed/PostComposerScreen` or
`../../app/(app)/compose` does not exist yet.

## Task 2.2: Add The Thin Compose Route

**Files:**
- Create: `mobile/app/(app)/compose.tsx`

- [ ] Add the route wrapper.

```tsx
import { PostComposerScreen } from '../../src/feed/PostComposerScreen';

export default function ComposeScreen() {
  return <PostComposerScreen />;
}
```

## Task 2.3: Add The Composer Screen

**Files:**
- Create: `mobile/src/feed/PostComposerScreen.tsx`

- [ ] Implement `PostComposerScreen` as a scrollable React Native screen.

Implementation contract:
- Export `PostComposerScreen` and an optional props type.
- Accept an optional `onSubmitInput?: (input: CreatePostInput) => void` prop
  used only by focused tests until Task 3 wires Relay.
- Initialize local state with `createPostComposerState()`.
- Track `submitAttempted` with `useState(false)`.
- Update body via `updatePostComposerBody`.
- Select post kind via `selectPostComposerKind`.
- Select visibility via `selectPostComposerVisibility`.
- Compute `validationMessage` with `getPostComposerValidationMessage(state)`.
- Disable `Post` when `!canSubmitPostComposer(state)`.
- On submit, call `buildCreatePostInput(state)`.
  - If it returns `null`, set `submitAttempted` to `true` and return.
  - If it returns input, call `onSubmitInput?.(input)`.
- On cancel, call `router.back()`.

Screen content:
- `ScrollView` root with `contentInsetAdjustmentBehavior="automatic"`.
- `AppHeader` with:
  - `eyebrow="Create"`
  - `title="Compose post"`
  - `subtitle="Share a text update with followers or publish it publicly."`
- One `AppCard` containing:
  - Label text `Post body`.
  - Multiline `TextInput` with `accessibilityLabel="Post body"`,
    `placeholder="What do you want to share?"`, `value={state.bodyText}`, and
    `placeholderTextColor={theme.colors.textMuted}`.
  - Counter text using tabular numbers:
    `${countPostComposerBodyTextCharacters(state.bodyText.trim())}/5000`
  - Validation text when `submitAttempted` is true, the body field has blurred,
    or the draft is over limit.
  - Kind controls for `Standard` and `Story` backed by `POST_COMPOSER_KINDS`.
  - Audience controls for `Followers` and `Public` backed by
    `POST_COMPOSER_VISIBILITIES`.
  - Action row with `Cancel` secondary button and `Post` primary button.
- Use only existing primitives and local `StyleSheet.create` styles.

Viewer copy:
- Empty validation: `Add text before posting.`
- Over-limit validation: `Posts must be 5,000 characters or fewer.`
- Kind labels: `Standard`, `Story`.
- Visibility labels: `Followers`, `Public`.

- [ ] Run the screen test and confirm it passes.

Run from `mobile/`:

```bash
bun test tests/feed/PostComposerScreen.test.tsx
```

Expected result: all `PostComposerScreen` tests pass.

## Task 2.4: Expose Compose From Home

**Files:**
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Modify: `mobile/tests/feed/FeedHomeScreen.test.tsx`

- [ ] Update the home action type and action factory.

Required action:

```ts
{
  key: 'compose',
  label: 'Create post',
  route: '/compose',
  variant: 'primary',
}
```

Implementation details:
- Add `'compose'` to `FeedHomeAction['key']`.
- Add `'/compose'` to `FeedHomeAction['route']`.
- Prepend the compose action in `createFeedHomeActions`.
- Keep the existing host/profile/diagnostics actions otherwise unchanged.
- Keep `pushFeedHomeAction` as the single route-push helper.

- [ ] Update `FeedHomeScreen.test.tsx`.

Required assertions:
- `createFeedHomeActions(true)` now returns compose first, then existing host,
  profile, and diagnostics actions.
- `createFeedHomeActions(false)` still returns compose, profile, and
  diagnostics.
- `pushFeedHomeAction` can push `/compose`.
- Rendering `FeedHomeContent`, pressing `Create post`, and inspecting
  `pushedRoutes` records `'/compose'`.

- [ ] Run the focused home test with the screen test.

Run from `mobile/`:

```bash
bun test tests/feed/PostComposerScreen.test.tsx tests/feed/FeedHomeScreen.test.tsx
```

Expected result: both focused test files pass.

## Task 2.5: Update Plan Evidence And Commit

**Files:**
- Modify: `docs/plans/mobile/2026-07-01-mobile-post-composer.md`
- Modify: `docs/plans/mobile/NOW.md`

- [ ] In `docs/plans/mobile/2026-07-01-mobile-post-composer.md`, check off the
      Task 2 acceptance criteria only after implementation passes focused
      tests.

- [ ] Add evidence under Task 2:

```md
Evidence:
- 2026-07-01: From `mobile/`,
  `bun test tests/feed/PostComposerScreen.test.tsx tests/feed/FeedHomeScreen.test.tsx`
  -> <actual pass/fail counts from command output>.
```

- [ ] In `docs/plans/mobile/NOW.md`, advance the current task to Task 3 only
      after Task 2 is complete and committed.

- [ ] Run lightweight final verification for the task.

Run from `mobile/`:

```bash
bun test tests/feed/PostComposerScreen.test.tsx tests/feed/FeedHomeScreen.test.tsx
bun run typecheck
```

Run from repo root:

```bash
git diff --check
```

- [ ] Commit the completed Task 2 milestone.

```bash
git add \
  mobile/app/'(app)'/compose.tsx \
  mobile/src/feed/PostComposerScreen.tsx \
  mobile/src/feed/FeedHomeScreen.tsx \
  mobile/tests/feed/PostComposerScreen.test.tsx \
  mobile/tests/feed/FeedHomeScreen.test.tsx \
  docs/plans/mobile/2026-07-01-mobile-post-composer.md \
  docs/plans/mobile/NOW.md
git commit -m "Add mobile post composer route and screen"
```

## Self-Review Checklist

- [ ] The route file is a thin wrapper and exports a default route component.
- [ ] The screen uses existing shell primitives before introducing any new UI
      primitive.
- [ ] The screen imports and uses Task 1 composer helpers instead of duplicating
      enum values or validation copy.
- [ ] `/home` exposes `Create post` and pushes `/compose`.
- [ ] No Relay mutation, generated Relay file, backend code, or media upload
      behavior was added.
- [ ] All mobile tests added by this task live under `mobile/tests/feed/**`.
