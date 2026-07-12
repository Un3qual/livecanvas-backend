# Backend Lane NOW

Last reviewed: 2026-07-11
Status: Batch 5 End-to-End Contact Invitations Task 1 next

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Cross-lane mobile contract work must name its backend write scope explicitly.
- Shared coordinator docs and contracts require explicit assignment.

## Current Batch

- Source plan:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
- Current task: Task 1, Add Recipient-Bound One-Time Consumption.
- Write scope: the migration, Accounts schemas/token lifecycle, Accounts
  transaction boundary, and focused token/account tests named in the plan.
- Done condition: recipient-bound one-time consumption and authenticated exact-
  token idempotent readback pass the focused database, Accounts, and type gates.

## Verification

- Reset the test database, run the focused token and Accounts suites, then run
  `mix typecheck`, touched-file formatting, and `git diff --check` as specified
  by Task 1.

## Next Action

Execute Task 1 from the Batch 5 source plan, then continue backend Tasks 2-3
before handing the configured landing and Relay consumption contract to mobile.

## References

- Mobile lane: `docs/plans/mobile/NOW.md`
- Active Batch 5 plan:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
