# Report Moderation Operations Implementation Plan

Date: 2026-07-08
Owner lane: backend
Status: draft ready for review

## Executor Brief

Add the first staff moderation operations batch after viewer reports: staff
authorization, report queue visibility, report decisions, GraphQL coverage, and
minimal operator-ready API. This is backend and GraphQL only; do not add a
Phoenix or mobile moderation UI in this batch.

This plan is not the active backend lane batch until
`docs/plans/backend/NOW.md` selects it.

## Context

- Viewer `reportPost` already exists and persists `post_reports`.
- `LCSchemas.Content.PostReport` already has `status` values:
  `open`, `reviewed`, `dismissed`, and `actioned`.
- Post report node fetchers are currently reporter-scoped through
  `Content.get_user_post_report/2`.
- The repo already has a LetMe-backed `LC.Authz` layer with authenticated scope
  checks. Extend that layer instead of inventing resolver-local staff checks.
- Follow backend conventions: `:utc_datetime_usec`, bigint relational IDs plus
  `:entropy_id`, Relay-first GraphQL, public typespecs, and node/child resolver
  authorization.

## Tasks

### Task 1: Add staff moderation authorization

Files:
- Create migration:
  `priv/repo/migrations/<timestamp>_create_staff_permissions.exs`
- Create: `lib/live_canvas_schemas/accounts/staff_permission.ex`
- Modify: `lib/live_canvas_schemas/accounts.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas/accounts/scope.ex`
- Modify: `lib/live_canvas/authz/policy.ex`
- Modify: `lib/live_canvas/authz/checks.ex`
- Test: `test/live_canvas/accounts_test.exs`
- Test: `test/live_canvas/authz/policy_test.exs`

Acceptance criteria:
- [ ] Add `staff_permissions` with bigint `id`, database-generated
      `entropy_id`, `user_id`, `permission`, `granted_at`, `revoked_at`, and
      `:utc_datetime_usec` timestamps.
- [ ] Support at least `:post_report_moderation`.
- [ ] Enforce one active permission per user and permission with a partial
      unique index.
- [ ] Add Accounts APIs for granting, revoking, and reading active staff
      permissions.
- [ ] Add staff permission data to `LC.Accounts.Scope`.
- [ ] Extend `LC.Authz.Policy` and `LC.Authz.Checks` with a transport-neutral
      moderation permission check.
- [ ] Cover active, revoked, missing, and unauthenticated scope behavior.

Focused verification:
- From repo root:
  `mix test test/live_canvas/accounts_test.exs test/live_canvas/authz/policy_test.exs`
- From repo root: `mix typecheck`

### Task 2: Add report queue and decision domain APIs

Files:
- Create migration:
  `priv/repo/migrations/<timestamp>_add_post_report_review_fields.exs`
- Modify: `lib/live_canvas_schemas/content/post_report.ex`
- Modify: `lib/live_canvas/content/post_report.ex`
- Modify: `lib/live_canvas/content.ex`
- Test: `test/live_canvas/content_test.exs`

Acceptance criteria:
- [ ] Add `reviewed_by_id`, `reviewed_at`, and `decision_note` to
      `post_reports`.
- [ ] Add indexes needed for a staff queue ordered by status and insertion
      time.
- [ ] Add `Content.list_post_reports_for_moderation/2` or equivalent query API
      that receives a staff-authorized scope.
- [ ] Add `Content.get_moderation_post_report/2` that authorizes through
      `LC.Authz`.
- [ ] Add `Content.decide_post_report/3` with row locking for decision writes.
- [ ] Allow `open -> reviewed`, `open -> dismissed`, `open -> actioned`, and
      `reviewed -> dismissed/actioned`.
- [ ] Treat `dismissed` and `actioned` as terminal unless product explicitly
      chooses reopen semantics later.
- [ ] Do not mutate posts automatically when a report is marked `actioned`.

Focused verification:
- From repo root: `mix test test/live_canvas/content_test.exs`
- From repo root: `mix typecheck`

### Task 3: Expose staff GraphQL queue and decision mutation

Files:
- Modify: `lib/live_canvas_gql/content/content_queries.ex`
- Modify: `lib/live_canvas_gql/content/content_mutations.ex`
- Modify: `lib/live_canvas_gql/content/content_types.ex`
- Modify: `lib/live_canvas_gql/content/content_resolver.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify if needed: `lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex`
- Test: `test/live_canvas_gql/content/content_queries_test.exs`
- Test: `test/live_canvas_gql/content/content_mutations_test.exs`
- Test: `test/live_canvas_gql/relay/node_queries_test.exs`
- Test if rate limiting changes:
  `test/live_canvas_web/plugs/graphql_mutation_rate_limit_test.exs`

Acceptance criteria:
- [ ] Add a staff-only Relay connection such as `staffPostReports`.
- [ ] Support filtering by report status and cursor pagination.
- [ ] Return an empty connection or a structured authorization error for
      nonstaff viewers, matching existing GraphQL authorization conventions.
- [ ] Add `decidePostReport(input: {reportId, status, decisionNote})`.
- [ ] Extend `PostReport` fields with staff-only review metadata and reported
      post access.
- [ ] Keep reporter-visible fields reporter-scoped.
- [ ] Update node fetchers so report IDs are accessible to either the reporter
      or a staff moderator, but not to arbitrary authenticated viewers.
- [ ] Add mutation rate-limit coverage if the rate-limit plug enumerates
      mutation names.

Focused verification:
- From repo root:
  `mix test test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs`
- From repo root: run the focused rate-limit plug test if that file changed.
- From repo root: `mix typecheck`

## Final Verification

- From repo root:
  `mix test test/live_canvas/accounts_test.exs test/live_canvas/authz/policy_test.exs test/live_canvas/content_test.exs`
- From repo root:
  `mix test test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs`
- From repo root: `mix typecheck`
- From repo root: `mix format`
- From repo root: `git diff --check`

## Handoff

This batch intentionally leaves staff bootstrapping to trusted operational setup.
Follow-up plans should cover operator UI, audit-event exports, notification
workflow, automatic post takedown policy, and mobile-visible appeal/report
history only after this backend API is stable.
