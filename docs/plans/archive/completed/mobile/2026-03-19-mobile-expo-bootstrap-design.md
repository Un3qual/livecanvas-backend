# Mobile Expo Bootstrap Design

Approved on 2026-03-19.

This document captures the approved bootstrap slice for creating the initial
mobile frontend workspace in `mobile/` without broadening the repository into a
repo-root JavaScript or Nix workspace.

## Goals

- Create the initial Expo app file structure under `mobile/`.
- Keep the toolchain isolated to `mobile/` with a local `flake.nix`.
- Use `pnpm dlx create-expo-app` with the `blank-typescript` template.
- Minimize root-level repo changes outside planning and any strictly necessary
  ignore rules.

## Non-Goals

- Add app-specific product features, routing decisions, or UI beyond the
  generated Expo starter.
- Introduce a repo-wide Nix dev shell, pnpm workspace, or Node.js workflow.
- Replace generated Expo defaults with custom architecture before the scaffold
  exists.

## Approved Decisions

- Keep the Nix boundary local to `mobile/` with `flake.nix` as the only required
  environment entrypoint for this slice.
- Generate the Expo project in-place from inside `mobile/` with:

  ```bash
  pnpm dlx create-expo-app . --template blank-typescript
  ```

- Prefer Expo's generated project structure and local `.gitignore` rules over
  hand-rolled files so the workspace starts from a standard baseline.
- Limit repository-level follow-up to planning updates plus any ignore changes
  that are truly required to keep generated local artifacts out of git.

## Bootstrap Flow

1. Create `mobile/flake.nix` with a focused dev shell plus a flake-provided
   `pnpm` app so the bootstrap can run through Nix without depending on host
   package-manager state.
2. Run the Expo generator via the flake-managed `pnpm` command. If existing
   local flake files already occupy `mobile/`, generate into a temporary
   directory first and then copy the scaffold into `mobile/`.
3. Review the generated files for collisions with existing repo conventions and
   adjust only the minimal surrounding files needed to keep the workspace clean.
4. Verify that the generated app metadata and TypeScript setup resolve from the
   flake-managed `pnpm` path.

## Verification

- Run the scaffold command successfully through the `mobile/` flake-managed
  `pnpm` executable.
- Confirm the generated Expo project files exist in `mobile/`.
- Run a lightweight generated-project verification command from the same shell
  rather than expanding scope into custom app implementation.

## Constraints And Risks

- Both flake resolution and `pnpm dlx create-expo-app` may require network
  access during bootstrap.
- This slice is generator- and configuration-heavy, so normal TDD does not add
  value before the scaffold exists.
- The approved mobile overview design in
  `docs/plans/mobile/2026-03-18-mobile-app-overview-design.md` still governs
  future architecture choices after bootstrap.
