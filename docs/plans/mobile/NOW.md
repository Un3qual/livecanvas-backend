# Mobile Lane NOW

Last reviewed: 2026-07-15
Status: release-candidate operator/device QA active

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Current Gate

- Checklist: `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`
- Completed plan: `docs/superpowers/plans/2026-07-15-basic-profile-identity.md`
- Current scope: release-operator target-environment inventory, preview build,
  and manual one-host/one-viewer device checks.
- Done condition: every launch blocker and required manual check has recorded
  operator evidence; local verification alone cannot close this gate.

## Deferred Scope

- Continuous device-contact mirroring/deletion, multi-viewer scale, store
  submission, and other checklist-deferred follow-up remain out of scope.

## Verification

- Closure evidence under Nix Node 26.5.0: frozen pnpm install and Relay
  generation; 32 focused Vitest and 65 focused Jest tests; both TypeScript
  checks, lint, 634 full Vitest tests, and 219 full Jest tests; `nix flake
  check` passes.

## Next Action

Release operator confirms the checklist prerequisites, then records the manual
host/viewer device evidence. Keep every physical-device item pending until run.
