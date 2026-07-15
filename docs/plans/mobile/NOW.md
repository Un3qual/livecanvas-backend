# Mobile Lane NOW

Last reviewed: 2026-07-15
Status: native contact import active

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Current Batch

- Design: `docs/superpowers/specs/2026-07-15-native-contact-import-design.md`
- Source plan: `docs/superpowers/plans/2026-07-15-native-contact-import.md`
- Current scope: Tasks 2-3—minimal native contact read boundary, pure
  normalization/chunking, sequential Relay import, and contact-screen feedback.
- Done condition: permission is user-initiated, only approved fields leave the
  device, successful imports refresh existing matches, and manual entry remains.
- Physical permission/device QA remains pending and is not completed here.

## Deferred Scope

- Continuous device-contact mirroring/deletion, multi-viewer scale, store
  submission, and other checklist-deferred follow-up remain out of scope.

## Verification

- Run focused native-normalization/adapter/state/RNTL suites, frozen pnpm
  installation, Relay generation, both TypeScript checks, lint, full Vitest and
  Jest suites, `nix flake check`, and patch hygiene.

## Next Action

Begin Task 2 after the backend bulk contract passes focused verification.
