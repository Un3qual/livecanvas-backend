# Backend Lane NOW

Last reviewed: 2026-07-09
Status: report moderation and cross-lane account/contact contracts complete

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Cross-lane mobile contract work must name its backend write scope explicitly.
- Shared coordinator docs and shared contracts require explicit assignment.

## Current Batch

- Source plan:
  `docs/plans/moderation/2026-07-08-report-moderation-operations.md`
- Task: complete, including PR review hardening.
- Write scope: staff report authorization, moderation queue and decision API,
  mutation limiting, identity unlink safety, contact-match projection, GraphQL
  schema, and focused backend tests.
- Done condition: met. Staff-only moderation operations are Relay-first and
  rate-limited; the latest terminal decision owns one atomic actor/time/note
  tuple; passwordless users cannot unlink their last provider identity; and
  persisted contact matches expose a viewer-owned invite recipient.
- Verification:
  - `mix test test/live_canvas/accounts_test.exs test/live_canvas/content_test.exs test/live_canvas_gql/accounts/contact_resolver_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas/accounts/auth_event_test.exs`
  - `mix typecheck`
  - `git diff --check`

## Next Action

No standalone backend batch is selected. Promote the next verified product
contract or runtime issue here before implementation. Do not reopen the broader
release-readiness roadmap solely because this cross-lane batch completed.

## References

- Previous completed backend foundation:
  `docs/plans/archive/completed/backend/2026-06-04-live-media-runtime-foundation.md`
- Mobile product-gap batch: `docs/plans/mobile/NOW.md`
