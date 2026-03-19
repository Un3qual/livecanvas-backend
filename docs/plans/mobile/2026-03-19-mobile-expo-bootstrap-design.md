# Mobile Expo Bootstrap Design

Approved on 2026-03-19.

This file captures the approved design snapshot for starting the mobile frontend
workspace under `mobile/`. It refines the planning-only direction in
`docs/plans/mobile/2026-03-18-mobile-app-overview-design.md` into the first
implementation slice that the user explicitly prioritized.

## Goals

- Create a standalone Expo app in `mobile/` with the default
  `create-expo-app` template.
- Use `pnpm` for scaffolding and package management.
- Use Nix-managed tooling for both the initial bootstrap and future local
  mobile development.
- Keep the Elixir backend repo root free of a repo-wide JavaScript workspace or
  other cross-project frontend scaffolding.

## Non-Goals

- Add Relay, Phoenix Channels, auth flows, or any product-specific mobile
  features.
- Reshape the default Expo app structure beyond the minimum needed to add Nix
  support and local usage instructions.
- Introduce a monorepo package manager setup at the repo root.
- Add CI, EAS, or native build customization in this slice.

## Approved Decisions

- `mobile/` remains a standalone app boundary rather than the first package in
  a repo-root workspace.
- The app is generated with `pnpm dlx create-expo-app mobile --template
  default`.
- Nix manages the bootstrap environment through an ad hoc shell for project
  creation and a committed `mobile/flake.nix` for repeatable local development.
- The generated Expo defaults stay intact unless a small change is required to
  document or support the Nix shell.

## Verification Strategy

- Confirm the generator creates the expected Expo app files in `mobile/`,
  including `package.json`, `app.json`, `tsconfig.json`, `.gitignore`, and
  `pnpm-lock.yaml`.
- Confirm the committed Nix dev shell can enter the mobile workspace and run an
  Expo CLI command successfully.
- Confirm no repo-root JavaScript workspace files are introduced as part of the
  bootstrap.

## Follow-Up

- Once this bootstrap slice is complete, restore `docs/plans/NOW.md` to the
  interrupted backend track unless the user explicitly continues mobile work.
