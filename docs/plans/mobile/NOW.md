# Mobile Lane NOW

Last reviewed: 2026-07-14
Status: local release gates complete; operator/device QA pending

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Completed Batch

- Design:
  `docs/superpowers/specs/2026-07-14-mobile-release-depth-next-five-design.md`
- Source plan:
  `docs/superpowers/plans/2026-07-14-mobile-release-depth-next-five.md`
- Completed scope: host local preview, live audience count, foreground/background
  live-session recovery, post/story media rendering, and a dedicated story
  viewer.
- Milestone commits: `078e501`, `5abdffa`, `43ea54b`, `0abc077`, and `e790acf`.
- Local evidence: frozen pnpm install and Relay generation pass; app/test
  typechecks and lint pass; Vitest passes 76 files and 563 tests; Jest/RNTL
  passes 27 suites and 182 tests; `nix flake check` and patch hygiene pass.
- No implementation batch is active. Local evidence does not complete the
  physical-device or target-environment checks.

## Deferred Scope

- Native address-book import, bulk contact upload, multi-viewer scale, store
  submission, and other checklist-deferred follow-up remain out of scope.

## Next Action

The release operator should satisfy the target-environment inventory and run
the physical-device QA in
`docs/plans/mobile/2026-06-25-release-candidate-checklist.md`. Promote any
reproduced defect into the owning lane before starting another feature batch.
