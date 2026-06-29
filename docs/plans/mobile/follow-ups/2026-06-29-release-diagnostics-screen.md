# Release Diagnostics Screen Implementation Plan

> **For agentic workers:** Use this only after it is promoted from
> `docs/plans/mobile/NOW.md`. Keep implementation mobile-owned.

**Goal:** Add an internal diagnostics screen that helps release operators verify
mobile endpoint configuration and basic connectivity in preview builds.

**Architecture:** Keep diagnostics read-only and operator-facing. The screen
should display the resolved runtime environment, auth/bootstrap state, and
manual reachability probes without adding analytics, crash reporting, or remote
EAS command execution.

**Tech Stack:** Expo Router, React Native, existing `StartupGate` environment,
auth provider, fetch/WebSocket probes, Bun tests.

---

## Executor Brief

The current RC blocker is partly operational: the preview build must prove it
is pointed at the intended API and websocket endpoints. Add a lightweight
diagnostics route reachable from the app home screen so an operator can confirm
configuration and run basic probes on-device.

## Context

- Runtime config resolves in `mobile/src/config/environment.ts`.
- Startup context is exposed by `mobile/src/providers/StartupGate.tsx`.
- Auth state is exposed by `mobile/src/auth/AuthProvider.tsx`.
- Home/discovery route is `mobile/src/live/discovery/LiveDiscoveryScreen.tsx`.
- App routes live under `mobile/app/**`.

## Tasks

### Task 1: Add pure diagnostics models

**Files:**
- Create: `mobile/src/diagnostics/releaseDiagnosticsPresentation.ts`
- Test: `mobile/tests/diagnostics/releaseDiagnosticsPresentation.test.ts`

Acceptance criteria:
- The model formats API and websocket URLs without redacting hostnames.
- Localhost fallback URLs are labelled as local defaults.
- Auth states render as loading, signed out, authenticated, or forced logout.
- Probe statuses render as not run, checking, reachable, or failed.

Implementation notes:
- Keep this file pure; no network calls and no React imports.
- Make the localhost warning explicit because preview builds should normally use
  target EAS environment values.

Focused verification:
- From `mobile/`:
  `bun test tests/diagnostics/releaseDiagnosticsPresentation.test.ts`

### Task 2: Add reachability probe helpers

**Files:**
- Create: `mobile/src/diagnostics/releaseDiagnosticsProbes.ts`
- Test: `mobile/tests/diagnostics/releaseDiagnosticsProbes.test.ts`

Acceptance criteria:
- API probe POSTs to `${apiBaseUrl}/graphql` with a minimal GraphQL payload.
- HTTP 2xx and parseable GraphQL JSON counts as reachable even if the GraphQL
  response contains auth errors.
- Network failures, non-JSON responses, and non-2xx transport failures report a
  short viewer-safe failure reason.
- WebSocket probe validates URL shape and attempts a short-lived socket open
  without joining an app channel.

Implementation notes:
- Keep timeout values named and small enough for an on-device manual check.
- Do not include access tokens in diagnostic output.

Focused verification:
- From `mobile/`:
  `bun test tests/diagnostics/releaseDiagnosticsProbes.test.ts`

### Task 3: Build the diagnostics screen

**Files:**
- Create: `mobile/src/diagnostics/ReleaseDiagnosticsScreen.tsx`
- Create: `mobile/app/(app)/diagnostics.tsx`
- Test: `mobile/tests/diagnostics/ReleaseDiagnosticsScreen.test.tsx`

Acceptance criteria:
- The screen shows API URL, websocket URL, boot session state, current auth
  state, and app startup snapshot state.
- The screen has separate `Check API` and `Check websocket` actions.
- Probe results are visible and do not expose tokens or raw stack traces.
- The screen can be opened while signed in.

Implementation notes:
- Use existing `AppHeader`, `AppCard`, and `AppButton` components.
- Use `useStartupState()` and `useAuth()` instead of adding a parallel runtime
  store.

Focused verification:
- From `mobile/`:
  `bun test tests/diagnostics/ReleaseDiagnosticsScreen.test.tsx`

### Task 4: Add a low-noise entry point from home

**Files:**
- Modify: `mobile/src/live/discovery/LiveDiscoveryScreen.tsx`
- Modify: `mobile/tests/live/LiveDiscoveryScreen.test.ts`

Acceptance criteria:
- Home shows a secondary `Diagnostics` action near `Open profile`.
- Pressing it navigates to `/diagnostics`.
- The action does not replace or hide host/live discovery actions.

Implementation notes:
- Keep the entry point visible for internal RC builds. If product later wants it
  hidden in production, add a separate build-flag plan.

Focused verification:
- From `mobile/`:
  `bun test tests/live/LiveDiscoveryScreen.test.ts`

## Final Verification

From `mobile/`:

- `bun test tests/diagnostics/releaseDiagnosticsPresentation.test.ts`
- `bun test tests/diagnostics/releaseDiagnosticsProbes.test.ts`
- `bun test tests/diagnostics/ReleaseDiagnosticsScreen.test.tsx`
- `bun test tests/live/LiveDiscoveryScreen.test.ts`
- `bun run test:quality`
- `bun run typecheck`

From repo root:

- `git diff --check`

## Handoff

This screen is for manual release checks only. Crash reporting, analytics, and
store-readiness metadata are separate follow-ups.
