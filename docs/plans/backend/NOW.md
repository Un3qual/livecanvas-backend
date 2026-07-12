# Backend Lane NOW

Last reviewed: 2026-07-11
Status: Batch 5 backend complete; release-candidate QA support only

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Cross-lane mobile contract work must name its backend write scope explicitly.
- Shared coordinator docs and contracts require explicit assignment.

## Current State

- Source plan:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
- Completed scope: Tasks 1-3 delivered recipient-bound one-time consumption,
  the configured fragment-only HTTPS landing contract, and authenticated Relay
  consumption.
- No backend implementation batch is active. Promote only a reproduced backend
  defect from release-candidate QA with an explicit write scope.

## Verification

- Batch 5 database reset, focused token/Accounts/controller/GraphQL suites,
  full backend tests, typecheck, asset build, and patch hygiene pass.

## Next Action

Stand by for release-candidate QA. If QA reproduces a backend contract,
authorization, token-lifecycle, or runtime defect, promote that defect here
before implementation.

## References

- Mobile lane: `docs/plans/mobile/NOW.md`
- Active Batch 5 plan:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
- Active mobile QA gate:
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`
