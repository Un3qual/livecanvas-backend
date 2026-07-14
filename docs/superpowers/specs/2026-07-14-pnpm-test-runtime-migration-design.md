# Pnpm Test Runtime Migration Design

## Context

LiveCanvas Mobile already uses pnpm for dependency resolution and commits only
`pnpm-lock.yaml`, but its quality scripts, 74 unit-test files, and shared unit
setup still require Bun. A second Jest/Expo suite owns the 24 React Native
Testing Library files.
The remaining migration is therefore a test-runtime and command-orchestration
change, not a package-lock conversion.

## Goals

- Make pnpm the only required command for mobile install, generation, tests,
  typechecks, lint, and the release quality gate.
- Replace all active `bun:test` usage, Bun typings, Bun commands, and Bun module
  cache workarounds.
- Preserve all 552 unit assertions and all 165 Jest rendering tests without
  changing production behavior.
- Keep module isolation explicit so test order and worker scheduling cannot
  leak mocks across files or cases.

## Non-Goals

- Do not combine the unit and React Native rendering suites into one runner.
- Do not refactor production code merely to accommodate a test runner.
- Do not rewrite archived plans or historical evidence that accurately records
  commands used at the time.
- Do not change EAS, Expo, backend, GraphQL, or Relay behavior.

## Architecture

Pnpm owns the public commands. `pnpm test:unit` runs Vitest over
`tests/**/*.test.{ts,tsx,js}` and `pnpm test:jest` retains the current Jest/Expo
configuration for `tests/**/*.rntl.tsx`. `pnpm test` runs both suites, while
`pnpm test:quality` runs application typecheck, test typecheck, lint, and both
test suites in that order.

Vitest is the unit runner because it supports the suite's existing TypeScript,
ES modules, top-level `await`, and dynamic imports without forcing the React
Native rendering suite out of the tested Jest/Expo environment. Introducing
Vitest is less risky than converting top-level-await and per-test module-cache
tests to Jest's CommonJS transform model.

## Mock And Module Isolation

- Replace Bun function mocks with `vi.fn` and lifecycle cleanup with Vitest's
  restore/reset APIs.
- Keep the shared React Native boundary in `tests/setup/reactNative.ts`, now
  installed through Vitest `setupFiles`.
- Use `vi.doMock` before dynamic imports when a file intentionally constructs
  its dependency graph after declaring test doubles.
- For tests that change a module factory per case, call `vi.resetModules` and
  dynamically import the stable module path. Remove random query-string imports
  that existed only to bypass Bun's module cache.
- Preserve restoration of mutated globals such as `globalThis.fetch`.

No compatibility wrapper will emulate Bun's callable `mock.module` API. Direct
Vitest primitives keep the runner boundary visible and avoid retaining a
test-only abstraction whose only purpose is the old runtime.

## Types And Dependencies

Add Vitest as a development dependency, remove `@types/bun`, and change the
unit-test TypeScript project from `bun-types/test` to Vitest types. Keep Jest
types isolated to the RNTL TypeScript project.

## Verification

Migration proceeds from narrow to broad:

1. Prove the new pnpm unit command is absent before configuration.
2. Run one representative converted pure unit test under Vitest.
3. Run converted module-mock files individually, including the concurrent auth
   and Phoenix socket cache-isolation cases.
4. Run the complete Vitest suite and confirm 552 tests remain.
5. Run `pnpm test:quality`, `pnpm typecheck`, and repo-root
   `git diff --check`.
6. Search active mobile code/config and current release docs for remaining Bun
   commands or types.

The release checklist and lane pointers will record the pnpm gate only after
the full migrated suite passes.
