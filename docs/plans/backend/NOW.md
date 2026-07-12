# Backend Lane NOW

Last reviewed: 2026-07-11
Status: Batch 5 End-to-End Contact Invitations Task 1 next

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Cross-lane mobile contract work must name its backend write scope explicitly.
- Shared coordinator docs and contracts require explicit assignment.

## Last Completed Batch

- Source plan:
  `docs/superpowers/plans/2026-07-11-live-chat-message-controls.md`
- Completed task: Task 1 proved the live-chat edit/remove contract.
- Result: ended sessions cannot remove chat rows; the action-specific backend
  authorizer preserves unrelated host lifecycle operations, and mutation plus
  channel responses expose the opaque reconciliation contract mobile consumes.

## Verification

- Focused chat mutation/channel suite: 53 tests, 0 failures.
- Full backend regression suite: 980 tests, 0 failures, 1 excluded.
- `mix typecheck` and `mix compile --warnings-as-errors` passed.
- Touched-file formatting and `git diff --check` passed.
- Actor-only edit, host-only removal, ended-session rejection, viewer-safe
  failures, repeated removal, and single-broadcast behavior have regression
  coverage.

## Current Batch

- Source plan:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
- Current task: Task 1, Add Recipient-Bound One-Time Consumption.
- Write scope: the migration, Accounts schemas/token lifecycle, Accounts
  transaction boundary, and focused token/account tests named in the plan.
- Done condition: recipient-bound one-time consumption and authenticated exact-
  token idempotent readback pass the focused database, Accounts, and type gates.

## Next Action

Execute Task 1 from the Batch 5 source plan, then continue backend Tasks 2-3
before handing the configured landing and Relay consumption contract to mobile.

## References

- Mobile lane: `docs/plans/mobile/NOW.md`
- Completed Batch 4 plan:
  `docs/superpowers/plans/2026-07-11-live-chat-message-controls.md`
- Active Batch 5 plan:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
