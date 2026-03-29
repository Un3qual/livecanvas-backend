# Mobile App Shell, Routing, And Global Providers Implementation Plan

**Goal:** Replace the default single-screen Expo entrypoint with a structured mobile app shell that has explicit route groups, provider boundaries, startup handling, and deep-link entry points for future auth and product surfaces.

**Architecture:** Keep the Expo scaffold isolated inside `mobile/`, adopt Expo Router unless a concrete native constraint makes plain React Navigation safer, and layer a small shell around theme, safe-area, startup, and error handling without pulling in backend data or channel logic yet. This slice should make the app ready for later Relay, auth, and live-session work while keeping runtime decisions explicit and reversible.

**Tech Stack:** Expo, React Native, TypeScript, Expo Router or React Navigation, `react-native-safe-area-context`, shell-level state and error boundaries

---

## Current State Verification

Verified directly in the codebase before drafting this plan:

1. `mobile/` exists with a bare Expo `blank-typescript` scaffold, including `mobile/App.tsx`, `mobile/index.ts`, `mobile/app.json`, `mobile/package.json`, `mobile/flake.nix`, and `mobile/tsconfig.json`.
2. The current app still renders the default starter screen; there is no route tree, provider stack, or shell-level loading/error handling yet.
3. `docs/plans/mobile/TRACK.md` still points at a planning batch rather than a concrete shell implementation slice.

## Scope Decisions

- Treat the existing Expo scaffold and local flake as the runtime baseline; do not reopen bootstrap work unless a concrete shell dependency forces it.
- Keep this slice focused on shell, routing, provider boundaries, and startup/deep-link behavior.
- Do not introduce Relay network code, auth mutations, Phoenix channel traffic, or media-specific client code in this batch.
- Keep shared UI primitives limited to what the shell needs: loading, error, layout, and navigation chrome.

## Progress

- [x] Task 1: Choose the routing model and define the top-level route groups
- [x] Task 2: Build the global provider stack and startup flow
- [x] Task 3: Add shell-level layout primitives and entry screens
- [x] Task 4: Verify the shell slice and advance the mobile planning pointers

### Task 1: Choose The Routing Model And Define The Top-Level Route Groups

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/app.json`
- Modify: `mobile/index.ts`
- Modify: `mobile/App.tsx`
- Create: `mobile/babel.config.js`
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/index.tsx`
- Create: `mobile/app/(auth)/_layout.tsx`
- Create: `mobile/app/(auth)/sign-in.tsx`
- Create: `mobile/app/(app)/_layout.tsx`
- Create: `mobile/app/(app)/home.tsx`
- Create: `mobile/app/(app)/profile.tsx`
- Create: `mobile/app/(modals)/_layout.tsx`
- Create: `mobile/app/(modals)/live-session.tsx`

**Task 1 Step Progress:**
- [x] Step 1: Compare Expo Router versus plain React Navigation against the current scaffold and choose the route model that minimizes glue code and future migration cost
- [x] Step 2: Update the app entrypoint and package scripts for the chosen router model so the shell boots from the intended root rather than the generated starter entry
- [x] Step 3: Create the initial route-group topology for unauthenticated entry, authenticated shell, live-session modal/screen entry, and profile entry
- [x] Step 4: Run the flake-managed `pnpm`/Expo sanity command for the chosen routing setup and confirm the app still boots from the mobile worktree

**Task 1 behavior targets:**

- The root app entry resolves through a deliberate router choice instead of the generated default screen.
- Route groups exist for entry, app shell, and modal overlays even if the screens themselves stay minimal.
- The chosen routing model does not require a second redesign before auth or Relay work starts.

**Suggested verification command:**

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec expo --version
```

Expected: PASS with an Expo version string from the isolated shell.

### Task 2: Build The Global Provider Stack And Startup Flow

**Files:**
- Modify: `mobile/App.tsx`
- Create: `mobile/src/providers/AppProviders.tsx`
- Create: `mobile/src/providers/ThemeProvider.tsx`
- Create: `mobile/src/providers/StartupGate.tsx`
- Create: `mobile/src/config/environment.ts`
- Create: `mobile/src/config/runtime.ts`

**Task 2 Step Progress:**
- [x] Step 1: Define the provider order for safe area, theme, shell error boundary, and startup gating without wiring in backend clients yet
- [x] Step 2: Add startup states for splash, stored-session hydration placeholder, forced logout shell reset, and deep-link handoff into the route groups
- [x] Step 3: Keep the provider seam ready for later Relay and Phoenix integration without adding those network clients in this batch
- [x] Step 4: Run the TypeScript and shell-boot checks for the provider tree

**Task 2 behavior targets:**

- The shell has a single root provider boundary that future auth, Relay, and realtime clients can plug into cleanly.
- Startup state is explicit instead of being hidden inside the first visible screen.
- Deep links can enter the app shell topology without bypassing the startup boundary.

**Suggested verification command:**

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

Expected: PASS.

### Task 3: Add Shell-Level Layout Primitives And Entry Screens

**Files:**
- Create: `mobile/src/components/AppHeader.tsx`
- Create: `mobile/src/components/AppButton.tsx`
- Create: `mobile/src/components/AppCard.tsx`
- Create: `mobile/src/components/ScreenState.tsx`
- Create: `mobile/src/theme/tokens.ts`
- Create: `mobile/src/theme/colors.ts`
- Modify: `mobile/app/(auth)/index.tsx`
- Modify: `mobile/app/(app)/index.tsx`

**Task 3 Step Progress:**
- [x] Step 1: Add the minimal shared shell components needed by the root routes, keeping them intentionally generic
- [x] Step 2: Define a small visual baseline for light theme, spacing, and touch targets that matches the media-heavy product direction
- [x] Step 3: Wire the initial entry screens to the shell primitives so the route topology is visible and testable
- [x] Step 4: Verify the generated structure renders cleanly from the flake-managed Expo shell

**Task 3 behavior targets:**

- The shell has reusable loading/error/empty primitives without pulling in product-specific UI too early.
- The initial routes look intentional enough for future auth and app-shell work to build on them.
- The visual system stays small and easy to replace when the full design system plan lands.

**Suggested verification command:**

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec expo start --clear
```

Expected: PASS or a clean Metro startup without route/runtime errors.

### Task 4: Verify The Shell Slice And Advance The Mobile Planning Pointers

**Files:**
- Modify: `docs/plans/mobile/TRACK.md`
- Modify: `docs/plans/mobile/NOW.md`

**Task 4 Step Progress:**
- [x] Step 1: Re-read the plan and confirm the shell slice is complete without leaking auth, Relay, or channel work
- [x] Step 2: Run the lane verification command and any shell sanity check needed to confirm the mobile workspace still exists and resolves
- [x] Step 3: Update the mobile track and lane pointer to the next post-shell foundations batch
- [x] Step 4: Commit the shell slice with the planning updates bundled alongside the implementation

**Suggested verification command:**

```bash
test -d mobile
test -f mobile/package.json
test -f mobile/flake.nix
```

Expected: PASS.
