# Mobile Lane NOW

Last reviewed: 2026-07-15
Status: basic profile identity active

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Current Batch

- Design: `docs/superpowers/specs/2026-07-15-basic-profile-identity-design.md`
- Source plan: `docs/superpowers/plans/2026-07-15-basic-profile-identity.md`
- Current scope: Tasks 3-4—shared profile identity presentation on every
  existing person surface and a generation-safe viewer editor.
- Done condition: public identity wins over email/opaque fallbacks, editing is
  validated and viewer-scoped, and all navigation stays on opaque Relay IDs.

## Deferred Scope

- Continuous device-contact mirroring/deletion, multi-viewer scale, store
  submission, and other checklist-deferred follow-up remain out of scope.

## Verification

- Run Relay generation, focused presentation/editor suites, frozen pnpm install,
  both TypeScript checks, lint, full tests, Nix, and patch hygiene.

## Next Action

Begin Task 3 after the backend exports the identity schema contract.
