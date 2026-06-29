# Live Discovery And Viewer Watch Flow Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build the first mobile live-session viewer path: discover visible live sessions, enter from home/profile/deep links, inspect a durable watch screen, and use viewer join/leave mutations.

**Architecture:** Keep this slice mobile-owned and Relay-first. Discovery and watch data come from `liveNow`, `User.currentLiveSession`, and `node(id:)`; participation uses `joinLiveSession` and `leaveLiveSession`. Do not add Phoenix Channel or media playback code in this batch because the published realtime topic currently requires a non-Relay integer session ID while the mobile GraphQL contract exposes Relay global IDs only.

**Tech Stack:** Expo Router, React Native, TypeScript, Relay, Bun unit tests, flake-managed `pnpm`.

---

## Current State Verification

Verified before drafting this plan:

1. `docs/plans/mobile/NOW.md` says profiles/social basics are complete and the next mobile batch is a detailed plan for live discovery plus viewer watch flow.
2. `docs/plans/mobile/TRACK.md` lists live discovery plus viewer watch flow as the next recommended detailed plan after the completed shell, Relay/auth, and profiles/social plans.
3. `mobile/schema.graphql` exposes `liveNow(first, after)`, `User.currentLiveSession`, Relay `node(id:)` for `LiveSession`, and `joinLiveSession` / `leaveLiveSession` mutations.
4. `docs/contracts/mobile-live-session-graphql.md` freezes the durable mobile live-session contract, including stable unauthorized fallbacks and mutation error shapes.
5. `docs/contracts/mobile-live-session-realtime.md` freezes the channel topic as `live_session:<session_id>` where `session_id` is a positive integer transport identifier, not a Relay global ID.
6. The current home route is still a placeholder shell in `mobile/app/(app)/home.tsx`, and `mobile/app/(modals)/live-session.tsx` is a placeholder modal.
7. The current mobile app has Relay/auth/profile foundations, shared shell components, `EXPO_PUBLIC_WEBSOCKET_URL`, and a provider seam for future channel providers.

## Scope Decisions

- Implement live discovery through `liveNow(first: 20)` on the signed-in home screen.
- Implement profile entry through `currentLiveSession` on both the viewer profile and other-user profile screens.
- Implement direct route entry through `/live-session?sessionId=<RelayLiveSessionID>`.
- Implement a watch screen that reads `node(id:)`, shows durable session state, and lets the viewer join and leave with GraphQL mutations.
- Treat `STARTING` and `LIVE` as enterable. Treat `ENDED`, unauthorized `node(id:) == null`, and wrong-type node results as non-enterable states with stable UI.
- Defer Phoenix Channel joining, viewer-count realtime updates, chat stream, and media playback. The follow-up contract dependency is a client-safe channel join identifier or topic derived from a Relay `LiveSession`.
- Defer replay discovery. Ended sessions may be displayed only when reached through `node(id:)`; replay feed belongs in a later replay-focused batch.
- Do not edit backend Elixir, GraphQL schema, or shared contract docs from this mobile lane implementation.

## File Structure

- `mobile/src/live/liveSessionPresentation.ts`: pure formatting and enterability helpers for session status, visibility, host labels, timestamps, and mutation errors.
- `mobile/src/live/liveSessionPresentation.test.ts`: Bun coverage for the helper contract.
- `mobile/src/live/liveSessionNavigation.ts`: route helpers for building and validating `/live-session` hrefs with Relay session IDs.
- `mobile/src/live/liveSessionNavigation.test.ts`: Bun coverage for route helper behavior.
- `mobile/src/live/LiveSessionSummaryCard.tsx`: reusable compact live-session card used by home and profile entry points.
- `mobile/src/live/LiveDiscoveryScreen.tsx`: Relay-backed home discovery screen with visible live sessions and empty/error/loading states.
- `mobile/src/live/liveSessionWatchReducer.ts`: pure reducer for join/leave submission state, row-level mutation errors, and stale mutation protection.
- `mobile/src/live/liveSessionWatchReducer.test.ts`: Bun coverage for watch action state.
- `mobile/src/live/LiveSessionWatchScreen.tsx`: Relay-backed watch screen with `node(id:)`, join/leave mutations, and non-enterable fallbacks.
- `mobile/app/(app)/home.tsx`: replace the placeholder home shell with `LiveDiscoveryScreen`.
- `mobile/app/(modals)/live-session.tsx`: parse the `sessionId` route param and render `LiveSessionWatchScreen`.
- `mobile/src/profile/ViewerProfileScreen.tsx`: include `viewer.currentLiveSession` and render a live entry card when present.
- `mobile/src/profile/OtherUserProfileScreen.tsx`: include `User.currentLiveSession` and render a live entry card when visible.
- `mobile/src/config/runtime.ts`: preserve live-session deep links with query params during startup routing.
- `mobile/src/config/runtime.test.ts`: cover protected live-session deep links for authenticated and unauthenticated startup.
- `docs/plans/mobile/TRACK.md`: advance current detailed plan status after implementation.
- `docs/plans/mobile/NOW.md`: track the active task while implementing and close the plan when complete.

## Progress

- [x] Task 1: Add live-session presentation and navigation helpers
- [x] Task 2: Build Relay-backed home live discovery
- [x] Task 3: Add profile-based live-session entry points
- [x] Task 4: Build the durable viewer watch screen with join/leave mutations
- [x] Task 5: Preserve live-session deep links through startup routing
- [x] Task 6: Verify the live discovery/watch slice and advance mobile planning pointers

### Task 1: Add Live-Session Presentation And Navigation Helpers

**Files:**
- Create: `mobile/src/live/liveSessionPresentation.test.ts`
- Create: `mobile/src/live/liveSessionPresentation.ts`
- Create: `mobile/src/live/liveSessionNavigation.test.ts`
- Create: `mobile/src/live/liveSessionNavigation.ts`

- [x] **Step 1: Write presentation helper tests**

Create `mobile/src/live/liveSessionPresentation.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';

import {
  canEnterLiveSession,
  formatLiveMutationErrors,
  formatLiveSessionStatus,
  formatLiveSessionTiming,
  formatLiveSessionVisibility,
} from './liveSessionPresentation';

describe('liveSessionPresentation', () => {
  test('formats known and future live-session statuses', () => {
    expect(formatLiveSessionStatus('STARTING')).toEqual({
      label: 'Starting soon',
      tone: 'pending',
    });
    expect(formatLiveSessionStatus('LIVE')).toEqual({
      label: 'Live now',
      tone: 'live',
    });
    expect(formatLiveSessionStatus('ENDED')).toEqual({
      label: 'Ended',
      tone: 'ended',
    });
    expect(formatLiveSessionStatus('%future added value')).toEqual({
      label: 'Status unavailable',
      tone: 'ended',
    });
  });

  test('treats starting and live sessions as enterable', () => {
    expect(canEnterLiveSession('STARTING')).toBe(true);
    expect(canEnterLiveSession('LIVE')).toBe(true);
    expect(canEnterLiveSession('ENDED')).toBe(false);
    expect(canEnterLiveSession('%future added value')).toBe(false);
  });

  test('formats visibility without leaking policy internals', () => {
    expect(formatLiveSessionVisibility('PUBLIC')).toBe('Public');
    expect(formatLiveSessionVisibility('FOLLOWERS')).toBe('Followers');
    expect(formatLiveSessionVisibility('%future added value')).toBe('Visibility unavailable');
  });

  test('formats timing from the status-specific timestamp', () => {
    expect(
      formatLiveSessionTiming({
        endedAt: null,
        insertedAt: '2026-06-01T16:00:00Z',
        startedAt: '2026-06-01T16:04:00Z',
        status: 'LIVE',
      }),
    ).toBe('Live since Jun 1, 2026');

    expect(
      formatLiveSessionTiming({
        endedAt: '2026-06-01T17:10:00Z',
        insertedAt: '2026-06-01T16:00:00Z',
        startedAt: '2026-06-01T16:04:00Z',
        status: 'ENDED',
      }),
    ).toBe('Ended Jun 1, 2026');
  });

  test('keeps malformed timing explicit', () => {
    expect(
      formatLiveSessionTiming({
        endedAt: null,
        insertedAt: 'not-a-date',
        startedAt: null,
        status: 'STARTING',
      }),
    ).toBe('Time unavailable');
  });

  test('maps mutation errors to viewer-safe copy', () => {
    expect(formatLiveMutationErrors([{ field: null, message: 'rate_limited' }])).toBe(
      'Too many live-session attempts. Wait a moment and try again.',
    );
    expect(
      formatLiveMutationErrors([{ field: 'liveSessionId', message: 'not_authorized' }]),
    ).toBe('This live session is not available to your account.');
    expect(formatLiveMutationErrors([])).toBe(
      'We could not update this live session. Check your connection and try again.',
    );
  });
});
```

- [x] **Step 2: Run presentation helper tests and verify RED**

Run:

```bash
cd mobile
bun test src/live/liveSessionPresentation.test.ts
```

Expected: FAIL because `src/live/liveSessionPresentation.ts` does not exist yet.

- [x] **Step 3: Implement presentation helpers**

Create `mobile/src/live/liveSessionPresentation.ts`:

```ts
export type LiveSessionStatus = 'STARTING' | 'LIVE' | 'ENDED' | string;
export type LiveSessionVisibility = 'PUBLIC' | 'FOLLOWERS' | string;
export type LiveMutationError = {
  readonly field?: string | null;
  readonly message?: string | null;
};

export type LiveStatusPresentation = {
  readonly label: string;
  readonly tone: 'pending' | 'live' | 'ended';
};

export function formatLiveSessionStatus(
  status: LiveSessionStatus,
): LiveStatusPresentation {
  switch (status) {
    case 'STARTING':
      return { label: 'Starting soon', tone: 'pending' };
    case 'LIVE':
      return { label: 'Live now', tone: 'live' };
    case 'ENDED':
      return { label: 'Ended', tone: 'ended' };
    default:
      return { label: 'Status unavailable', tone: 'ended' };
  }
}

export function canEnterLiveSession(status: LiveSessionStatus): boolean {
  return status === 'STARTING' || status === 'LIVE';
}

export function formatLiveSessionVisibility(
  visibility: LiveSessionVisibility,
): string {
  switch (visibility) {
    case 'PUBLIC':
      return 'Public';
    case 'FOLLOWERS':
      return 'Followers';
    default:
      return 'Visibility unavailable';
  }
}

function formatShortDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(parsed);
}

export function formatLiveSessionTiming({
  endedAt,
  insertedAt,
  startedAt,
  status,
}: {
  readonly endedAt?: string | null;
  readonly insertedAt: string;
  readonly startedAt?: string | null;
  readonly status: LiveSessionStatus;
}): string {
  if (status === 'ENDED') {
    const ended = formatShortDate(endedAt);
    return ended ? `Ended ${ended}` : 'Time unavailable';
  }

  if (status === 'LIVE') {
    const started = formatShortDate(startedAt);
    return started ? `Live since ${started}` : 'Time unavailable';
  }

  if (status === 'STARTING') {
    const created = formatShortDate(insertedAt);
    return created ? `Created ${created}` : 'Time unavailable';
  }

  return 'Time unavailable';
}

export function formatLiveMutationErrors(
  errors: ReadonlyArray<LiveMutationError> | null | undefined,
): string {
  const firstMessage = errors?.find((error) => error?.message)?.message;

  switch (firstMessage) {
    case 'rate_limited':
      return 'Too many live-session attempts. Wait a moment and try again.';
    case 'not_authorized':
    case 'not_found':
    case 'ended':
      return 'This live session is not available to your account.';
    case 'unauthenticated':
      return 'Sign in again to keep watching live sessions.';
    default:
      return 'We could not update this live session. Check your connection and try again.';
  }
}
```

- [x] **Step 4: Run presentation helper tests and verify GREEN**

Run:

```bash
cd mobile
bun test src/live/liveSessionPresentation.test.ts
```

Expected: PASS.

- [x] **Step 5: Write navigation helper tests**

Create `mobile/src/live/liveSessionNavigation.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';

import {
  liveSessionHref,
  readLiveSessionIdParam,
} from './liveSessionNavigation';

describe('liveSessionNavigation', () => {
  test('builds a stable modal href with the Relay live-session ID as a query param', () => {
    expect(liveSessionHref('TGl2ZVNlc3Npb246MTIz')).toEqual({
      pathname: '/live-session',
      params: { sessionId: 'TGl2ZVNlc3Npb246MTIz' },
    });
  });

  test('reads the first session ID when Expo Router provides repeated params', () => {
    expect(readLiveSessionIdParam(['first', 'second'])).toBe('first');
  });

  test('rejects missing or blank session ID params', () => {
    expect(readLiveSessionIdParam(undefined)).toBeNull();
    expect(readLiveSessionIdParam('   ')).toBeNull();
  });
});
```

- [x] **Step 6: Run navigation helper tests and verify RED**

Run:

```bash
cd mobile
bun test src/live/liveSessionNavigation.test.ts
```

Expected: FAIL because `src/live/liveSessionNavigation.ts` does not exist yet.

- [x] **Step 7: Implement navigation helpers**

Create `mobile/src/live/liveSessionNavigation.ts`:

```ts
export function liveSessionHref(sessionId: string) {
  return {
    pathname: '/live-session' as const,
    params: { sessionId },
  };
}

export function readLiveSessionIdParam(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
```

- [x] **Step 8: Run Task 1 tests and commit**

Run:

```bash
cd mobile
bun test src/live/liveSessionPresentation.test.ts src/live/liveSessionNavigation.test.ts
```

Expected: PASS.

Commit:

```bash
git add mobile/src/live/liveSessionPresentation.test.ts mobile/src/live/liveSessionPresentation.ts mobile/src/live/liveSessionNavigation.test.ts mobile/src/live/liveSessionNavigation.ts
git commit -m "feat(mobile): add live session presentation helpers"
```

### Task 2: Build Relay-Backed Home Live Discovery

**Files:**
- Create: `mobile/src/live/LiveSessionSummaryCard.tsx`
- Create: `mobile/src/live/LiveDiscoveryScreen.tsx`
- Modify: `mobile/app/(app)/home.tsx`
- Generated: `mobile/src/live/__generated__/LiveDiscoveryScreenQuery.graphql.ts`

- [x] **Step 1: Create the shared live-session summary card**

Create `mobile/src/live/LiveSessionSummaryCard.tsx` with props that accept a Relay session fragment-shaped object:

```ts
type LiveSessionSummary = {
  readonly endedAt?: string | null;
  readonly host: { readonly email?: string | null; readonly id: string };
  readonly id: string;
  readonly insertedAt: string;
  readonly startedAt?: string | null;
  readonly status: string;
  readonly visibility: string;
};
```

Render:
- status badge from `formatLiveSessionStatus`
- host title using `formatProfileIdentity(session.host)`
- timing from `formatLiveSessionTiming`
- visibility from `formatLiveSessionVisibility`
- primary `AppButton` with caller-provided label and `onPress`

Use existing `AppCard`, `AppButton`, `useAppTheme`, `spacing`, `radius`, and `typography`. Keep the card max width consistent with existing shell/profile cards.

- [x] **Step 2: Build the discovery screen query**

Create `mobile/src/live/LiveDiscoveryScreen.tsx` with this Relay query:

```graphql
query LiveDiscoveryScreenQuery($first: Int!) {
  liveNow(first: $first) {
    edges {
      node {
        id
        status
        visibility
        insertedAt
        startedAt
        endedAt
        host {
          id
          email
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
  viewer {
    id
    currentLiveSession {
      id
      status
      visibility
      insertedAt
      startedAt
      endedAt
      host {
        id
        email
      }
    }
  }
}
```

Use `useLazyLoadQuery` with `{ first: 20 }` and `fetchPolicy: 'store-and-network'`.

- [x] **Step 3: Add loading, error, empty, and list rendering**

Wrap `LiveDiscoveryScreen` in a local error boundary and `Suspense`, following the current `ViewerProfileScreen` pattern.

Behavior:
- show `ScreenState` loading while Relay suspends
- show `ScreenState` error with retry when the query throws
- show a "Your live session" summary first when `viewer.currentLiveSession` exists
- show visible `liveNow` cards below it, excluding a duplicate of `viewer.currentLiveSession.id`
- show `ScreenState` empty when there is no current session and no visible live sessions
- navigate with `router.push(liveSessionHref(session.id))`

- [x] **Step 4: Replace the home placeholder**

Modify `mobile/app/(app)/home.tsx` to render only:

```ts
import { LiveDiscoveryScreen } from '../../src/live/LiveDiscoveryScreen';

export default function HomeScreen() {
  return <LiveDiscoveryScreen />;
}
```

- [x] **Step 5: Run Relay codegen and TypeScript**

Run:

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec relay-compiler
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

Expected: Relay artifact is generated and TypeScript passes.

- [x] **Step 6: Commit Task 2**

Commit:

```bash
git add 'mobile/app/(app)/home.tsx' mobile/src/live/LiveSessionSummaryCard.tsx mobile/src/live/LiveDiscoveryScreen.tsx mobile/src/live/__generated__/LiveDiscoveryScreenQuery.graphql.ts
git commit -m "feat(mobile): add live discovery home"
```

### Task 3: Add Profile-Based Live-Session Entry Points

**Files:**
- Modify: `mobile/src/profile/ViewerProfileScreen.tsx`
- Modify: `mobile/src/profile/OtherUserProfileScreen.tsx`
- Generated: `mobile/src/profile/__generated__/ViewerProfileScreenQuery.graphql.ts`
- Generated: `mobile/src/profile/__generated__/OtherUserProfileScreenQuery.graphql.ts`

- [x] **Step 1: Add `currentLiveSession` to the viewer profile query**

Extend `ViewerProfileScreenQuery.viewer` with:

```graphql
currentLiveSession {
  id
  status
  visibility
  insertedAt
  startedAt
  endedAt
  host {
    id
    email
  }
}
```

- [x] **Step 2: Render the viewer's current live entry**

In `ViewerProfileContent`, render `LiveSessionSummaryCard` above the follower/following stats when `data.viewer.currentLiveSession` is present. Use button label `Open live session` and navigate with `router.push(liveSessionHref(session.id))`.

- [x] **Step 3: Add `currentLiveSession` to the other-user profile query**

Extend the `... on User` selection in `OtherUserProfileScreenQuery` with the same `currentLiveSession` fields.

- [x] **Step 4: Render visible other-user live entry**

In `OtherUserProfileContent`, render `LiveSessionSummaryCard` after the identity section when `user.currentLiveSession` is present. Use button label `Watch live` and navigate with `router.push(liveSessionHref(user.currentLiveSession.id))`.

- [x] **Step 5: Run Relay codegen and TypeScript**

Run:

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec relay-compiler
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

Expected: profile query artifacts update and TypeScript passes.

- [x] **Step 6: Commit Task 3**

Commit:

```bash
git add mobile/src/profile/ViewerProfileScreen.tsx mobile/src/profile/OtherUserProfileScreen.tsx mobile/src/profile/__generated__/ViewerProfileScreenQuery.graphql.ts mobile/src/profile/__generated__/OtherUserProfileScreenQuery.graphql.ts
git commit -m "feat(mobile): add profile live session entry"
```

### Task 4: Build The Durable Viewer Watch Screen With Join/Leave Mutations

**Files:**
- Create: `mobile/src/live/liveSessionWatchReducer.test.ts`
- Create: `mobile/src/live/liveSessionWatchReducer.ts`
- Create: `mobile/src/live/LiveSessionWatchScreen.tsx`
- Modify: `mobile/app/(modals)/live-session.tsx`
- Generated: `mobile/src/live/__generated__/LiveSessionWatchScreenQuery.graphql.ts`
- Generated: `mobile/src/live/__generated__/LiveSessionWatchScreenJoinMutation.graphql.ts`
- Generated: `mobile/src/live/__generated__/LiveSessionWatchScreenLeaveMutation.graphql.ts`

- [x] **Step 1: Write watch reducer tests**

Create `mobile/src/live/liveSessionWatchReducer.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';

import {
  createLiveSessionWatchState,
  liveSessionWatchReducer,
} from './liveSessionWatchReducer';

describe('liveSessionWatchReducer', () => {
  test('tracks join submission and success', () => {
    const joining = liveSessionWatchReducer(createLiveSessionWatchState(), {
      type: 'join_started',
      sessionId: 'session-1',
    });

    expect(joining).toEqual({
      activeSessionId: 'session-1',
      error: null,
      isJoined: false,
      submission: 'joining',
    });

    expect(
      liveSessionWatchReducer(joining, {
        type: 'join_succeeded',
        sessionId: 'session-1',
      }),
    ).toEqual({
      activeSessionId: 'session-1',
      error: null,
      isJoined: true,
      submission: 'idle',
    });
  });

  test('ignores stale join completions from an older session', () => {
    const state = liveSessionWatchReducer(createLiveSessionWatchState(), {
      type: 'join_started',
      sessionId: 'new-session',
    });

    expect(
      liveSessionWatchReducer(state, {
        type: 'join_succeeded',
        sessionId: 'old-session',
      }),
    ).toBe(state);
  });

  test('tracks leave success and clears joined state', () => {
    const joined = {
      activeSessionId: 'session-1',
      error: null,
      isJoined: true,
      submission: 'idle' as const,
    };

    const leaving = liveSessionWatchReducer(joined, {
      type: 'leave_started',
      sessionId: 'session-1',
    });

    expect(leaving.submission).toBe('leaving');

    expect(
      liveSessionWatchReducer(leaving, {
        type: 'leave_succeeded',
        sessionId: 'session-1',
      }),
    ).toEqual({
      activeSessionId: 'session-1',
      error: null,
      isJoined: false,
      submission: 'idle',
    });
  });

  test('stores viewer-safe mutation errors', () => {
    const joining = liveSessionWatchReducer(createLiveSessionWatchState(), {
      type: 'join_started',
      sessionId: 'session-1',
    });

    expect(
      liveSessionWatchReducer(joining, {
        error: 'This live session is not available to your account.',
        sessionId: 'session-1',
        type: 'join_failed',
      }),
    ).toEqual({
      activeSessionId: 'session-1',
      error: 'This live session is not available to your account.',
      isJoined: false,
      submission: 'idle',
    });
  });
});
```

- [x] **Step 2: Run watch reducer tests and verify RED**

Run:

```bash
cd mobile
bun test src/live/liveSessionWatchReducer.test.ts
```

Expected: FAIL because `src/live/liveSessionWatchReducer.ts` does not exist yet.

- [x] **Step 3: Implement watch reducer**

Create `mobile/src/live/liveSessionWatchReducer.ts` with this public state and action contract:

```ts
export type LiveSessionWatchSubmission = 'idle' | 'joining' | 'leaving';

export type LiveSessionWatchState = {
  readonly activeSessionId: string | null;
  readonly error: string | null;
  readonly isJoined: boolean;
  readonly submission: LiveSessionWatchSubmission;
};

export type LiveSessionWatchAction =
  | { readonly type: 'join_started'; readonly sessionId: string }
  | { readonly type: 'join_succeeded'; readonly sessionId: string }
  | { readonly type: 'join_failed'; readonly sessionId: string; readonly error: string }
  | { readonly type: 'leave_started'; readonly sessionId: string }
  | { readonly type: 'leave_succeeded'; readonly sessionId: string }
  | { readonly type: 'leave_failed'; readonly sessionId: string; readonly error: string }
  | { readonly type: 'session_changed'; readonly sessionId: string };
```

Rules:
- `createLiveSessionWatchState()` returns idle, not joined, no active session.
- `session_changed` resets error, joined state, and submission when the route changes.
- success/failure actions whose `sessionId` does not match `activeSessionId` return the previous state object unchanged.
- `leave_failed` keeps `isJoined: true` so the user can retry cleanup.

- [x] **Step 4: Run watch reducer tests and verify GREEN**

Run:

```bash
cd mobile
bun test src/live/liveSessionWatchReducer.test.ts
```

Expected: PASS.

- [x] **Step 5: Replace the live-session modal route**

Modify `mobile/app/(modals)/live-session.tsx` to:
- call `useLocalSearchParams<{ sessionId?: string | string[] }>()`
- derive `sessionId` with `readLiveSessionIdParam`
- render `ScreenState` error with message `Choose a live session to continue.` when missing
- render `<LiveSessionWatchScreen sessionId={sessionId} />` when present

- [x] **Step 6: Build the watch screen query and mutations**

Create `mobile/src/live/LiveSessionWatchScreen.tsx` with query:

```graphql
query LiveSessionWatchScreenQuery($id: ID!) {
  node(id: $id) {
    __typename
    ... on LiveSession {
      id
      status
      visibility
      insertedAt
      startedAt
      endedAt
      host {
        id
        email
      }
      recordingMediaAsset {
        id
        processingState
        publicUrl
      }
    }
  }
}
```

Add mutations:

```graphql
mutation LiveSessionWatchScreenJoinMutation($input: JoinLiveSessionInput!) {
  joinLiveSession(input: $input) {
    liveSession {
      id
      status
      visibility
      insertedAt
      startedAt
      endedAt
      host {
        id
        email
      }
    }
    errors {
      field
      message
    }
  }
}
```

```graphql
mutation LiveSessionWatchScreenLeaveMutation($input: LeaveLiveSessionInput!) {
  leaveLiveSession(input: $input) {
    left
    errors {
      field
      message
    }
  }
}
```

- [x] **Step 7: Render durable watch states**

Behavior:
- loading: `ScreenState` with `Loading live session...`
- query error: retryable `ScreenState`
- `node == null` or `__typename !== 'LiveSession'`: unavailable state with a back button
- `ENDED`: show ended state and disable join
- `STARTING` / `LIVE`: show status, host, visibility, timing, and recording metadata only if present
- before join: primary button `Join live`
- after successful join: show joined state and secondary button `Leave live`
- mutation payload errors: display `formatLiveMutationErrors(errors)`
- mutation transport errors: display the default `formatLiveMutationErrors([])` copy

Use `useReducer(liveSessionWatchReducer, createLiveSessionWatchState())`, `useMutation`, and a local error boundary following existing profile screen patterns.

- [x] **Step 8: Run Task 4 verification**

Run:

```bash
cd mobile
bun test src/live/liveSessionWatchReducer.test.ts
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec relay-compiler
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

Expected: reducer tests pass, Relay artifacts are generated, and TypeScript passes.

- [x] **Step 9: Commit Task 4**

Commit:

```bash
git add 'mobile/app/(modals)/live-session.tsx' mobile/src/live/liveSessionWatchReducer.test.ts mobile/src/live/liveSessionWatchReducer.ts mobile/src/live/LiveSessionWatchScreen.tsx mobile/src/live/__generated__/LiveSessionWatchScreenQuery.graphql.ts mobile/src/live/__generated__/LiveSessionWatchScreenJoinMutation.graphql.ts mobile/src/live/__generated__/LiveSessionWatchScreenLeaveMutation.graphql.ts
git commit -m "feat(mobile): add live session watch flow"
```

### Task 5: Preserve Live-Session Deep Links Through Startup Routing

**Files:**
- Modify: `mobile/src/config/runtime.test.ts`
- Modify: `mobile/src/config/runtime.ts`

- [x] **Step 1: Add runtime deep-link tests**

Extend `mobile/src/config/runtime.test.ts`:

```ts
test('preserves live-session query params in known protected deep links', () => {
  expect(
    routeHrefFromUrl(
      'livecanvas-mobile://live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
    ),
  ).toBe('/live-session?sessionId=TGl2ZVNlc3Npb246MTIz');
});

test('sends unauthenticated live-session deep links to sign-in', () => {
  expect(
    resolveLandingHrefForAuth(
      {
        initialUrl: 'livecanvas-mobile://live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
        initialHref: '/live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
        landingHref: '/live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
        defaultHref: '/sign-in',
        bootSessionState: 'signed_out',
        resetReason: null,
      },
      'unauthenticated',
    ),
  ).toBe('/sign-in');
});

test('preserves authenticated live-session deep links after auth settles', () => {
  expect(
    resolveLandingHrefForAuth(
      {
        initialUrl: 'livecanvas-mobile://live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
        initialHref: '/live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
        landingHref: '/live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
        defaultHref: '/home',
        bootSessionState: 'authenticated',
        resetReason: null,
      },
      'authenticated',
    ),
  ).toBe('/live-session?sessionId=TGl2ZVNlc3Npb246MTIz');
});
```

- [x] **Step 2: Run runtime tests and verify RED**

Run:

```bash
cd mobile
bun test src/config/runtime.test.ts
```

Expected: FAIL because `routeHrefFromUrl` currently strips query params.

- [x] **Step 3: Update startup route parsing**

Modify `mobile/src/config/runtime.ts`:
- keep `KNOWN_ROUTE_HREFS` as route paths without query params
- parse the initial URL into `path` and `query`
- accept `/live-session` as known
- return `/live-session?<query>` only when the query is non-empty
- keep auth-route detection based on the path portion before `?`

Implementation outline:

```ts
function routePathFromHref(href: string): string {
  return href.split('?', 1)[0] ?? href;
}
```

Use `routePathFromHref(snapshot.initialHref)` when checking `AUTH_ROUTE_HREFS`.

- [x] **Step 4: Run runtime tests and TypeScript**

Run:

```bash
cd mobile
bun test src/config/runtime.test.ts
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

Expected: PASS.

- [x] **Step 5: Commit Task 5**

Commit:

```bash
git add mobile/src/config/runtime.test.ts mobile/src/config/runtime.ts
git commit -m "feat(mobile): preserve live session deep links"
```

### Task 6: Verify The Live Discovery/Watch Slice And Advance Mobile Planning Pointers

**Files:**
- Modify: `docs/plans/mobile/2026-06-01-live-discovery-viewer-watch-flow.md`
- Modify: `docs/plans/mobile/TRACK.md`
- Modify: `docs/plans/mobile/NOW.md`

- [x] **Step 1: Run focused mobile tests**

Run:

```bash
cd mobile
bun test src/live/liveSessionPresentation.test.ts src/live/liveSessionNavigation.test.ts src/live/liveSessionWatchReducer.test.ts src/config/runtime.test.ts
```

Expected: PASS.

- [x] **Step 2: Run Relay and TypeScript verification**

Run:

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec relay-compiler
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

Expected: PASS.

- [x] **Step 3: Re-read the slice for scope leaks**

Confirm:
- no backend Elixir, backend GraphQL schema, or shared contract files changed
- no Phoenix Channel dependency or client was added
- no media playback SDK was selected
- no chat-history or chat-realtime UI was introduced
- no replay discovery was introduced

- [x] **Step 4: Update the mobile plan progress**

In this file, mark completed task checkboxes and add a short verification note with the exact commands run.

- [x] **Step 5: Advance mobile lane pointers**

Update `docs/plans/mobile/TRACK.md` and `docs/plans/mobile/NOW.md`:
- status: live discovery plus durable viewer watch flow complete
- completed detailed plans: add this plan
- next detailed plan: host broadcast native capability and preflight planning, unless the coordinator explicitly prioritizes channel transport contract repair first
- note the backend contract dependency for future Phoenix Channel work: mobile needs a client-safe channel join identifier or topic derived from a Relay `LiveSession`

- [x] **Step 6: Commit Task 6**

Commit:

```bash
git add docs/plans/mobile/2026-06-01-live-discovery-viewer-watch-flow.md docs/plans/mobile/TRACK.md docs/plans/mobile/NOW.md
git commit -m "docs(mobile): close live discovery watch plan"
```

## Verification Note

Completed on 2026-06-01.

Commands run:

```bash
cd mobile
bun test src/live/liveSessionPresentation.test.ts src/live/liveSessionNavigation.test.ts src/live/liveSessionWatchReducer.test.ts src/config/runtime.test.ts
./node_modules/.bin/relay-compiler
./node_modules/.bin/tsc --noEmit
cd ..
git diff --check
```

Results:
- Focused Bun tests passed: 33 tests, 0 failures, 64 assertions.
- Relay compiler passed after running outside the sandbox because Watchman could not update `/Users/admin/.local/state/watchman/admin-state` inside the sandbox.
- Local TypeScript `./node_modules/.bin/tsc --noEmit` passed.
- `git diff --check` passed.

Nix note:
- The plan's Nix-wrapped Relay and TypeScript commands could not run in this environment because `/nix/var/nix/daemon-socket/socket` refused connections.
- The same Nix daemon failure occurred inside the sandbox and after escalation, so local mobile toolchain commands were used for the final verification evidence.

## Final Verification Command Set

Run before asking for review:

```bash
cd mobile
bun test src/live/liveSessionPresentation.test.ts src/live/liveSessionNavigation.test.ts src/live/liveSessionWatchReducer.test.ts src/config/runtime.test.ts
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec relay-compiler
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
cd ..
git diff --check
```

Expected: all commands pass when the Nix daemon is available. In this checkout,
the local Relay and TypeScript equivalents passed as recorded in the
verification note above.

## Follow-Up Dependency

The current realtime contract requires `live_session:<session_id>` with a positive integer `session_id`, but mobile GraphQL surfaces expose Relay global IDs only. A future mobile channel batch should not decode Relay IDs client-side. It should first get an approved backend contract for a client-safe `LiveSession` channel identifier, channel topic, or viewer join token.
