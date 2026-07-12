# Mobile Lane NOW

Last reviewed: 2026-07-11
Status: Batch 4 complete; Batch 5 waits for backend Tasks 1-3

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Current Batch

- Batch 5 mobile Tasks 4-5 wait for the backend token, landing, and Relay
  consumption contracts in Tasks 1-3.
- Source plan:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
- Write scope after the backend handoff: protected invite routing, authenticated
  consumption, and explicit contact-row delivery state named in Tasks 4-5.
- Done condition: the focused invite suites, Relay generation, typechecks, full
  mobile quality gate, and patch hygiene pass.

## Deferred Scope

- Content details, comments, reactions, replay management, native address-book
  import, and release-candidate QA remain out of scope.

## Next Action

Wait for backend Tasks 1-3 in
`docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`, then
execute mobile Tasks 4-5.
