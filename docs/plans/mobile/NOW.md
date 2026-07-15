# Mobile Lane NOW

Last reviewed: 2026-07-15
Status: release-candidate operator/device QA active

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Current Gate

- Checklist: `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`
- Latest completed plan:
  `docs/superpowers/plans/2026-07-15-native-contact-import.md`
- Completed scope: minimal native contact read boundary, pure
  normalization/chunking, sequential Relay import, and contact-screen feedback.
- Local closure passed frozen pnpm install, Relay generation, both TypeScript
  checks, lint, 84 Vitest files/626 tests, 29 Jest files/215 tests, and Nix.
- Physical contact permission/import evidence remains pending with the rest of
  operator/device QA and is not completed here.

## Deferred Scope

- Continuous device-contact mirroring/deletion, multi-viewer scale, store
  submission, and other checklist-deferred follow-up remain out of scope.

## Verification

- Use the checklist for target-environment inventory and physical-device
  evidence; do not repeat completed local gates unless code changes.

## Next Action

Confirm the target environment, preview artifact, test identities, recipient
inbox, and physical devices; then begin checklist QA.
