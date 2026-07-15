# Mobile Lane NOW

Last reviewed: 2026-07-14
Status: five release-depth batches implemented; closure verification active

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Current Batch

- Design:
  `docs/superpowers/specs/2026-07-14-mobile-release-depth-next-five-design.md`
- Source plan:
  `docs/superpowers/plans/2026-07-14-mobile-release-depth-next-five.md`
- Current scope: close the five-batch lane with full Relay, type, lint, unit,
  Jest/RNTL, frozen-install, and Nix verification evidence.
- Write scope: closure docs plus any directly reproduced regression in the five
  implemented batches. Promote backend work only if a contract test fails.
  pointer. Promote backend work only if a focused contract test fails.
- Done condition: every local release-depth gate passes, detailed evidence is
  recorded, and the lane returns to physical-device/operator QA without marking
  that external QA complete.
- Verification: `CI=true pnpm install --frozen-lockfile`, `pnpm relay`,
  `pnpm test:quality`, `nix flake check`, and patch hygiene.

## Deferred Scope

- Native address-book import, bulk contact upload, multi-viewer scale, store
  submission, and other checklist-deferred follow-up remain out of scope.

## Next Action

Run the full closure matrix, record results, and publish the sequence in one
non-draft PR.
