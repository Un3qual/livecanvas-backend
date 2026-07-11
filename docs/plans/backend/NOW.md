# Backend Lane NOW

Last reviewed: 2026-07-11
Status: Batch 3 Media Post Publishing planned; awaiting approval

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Cross-lane mobile contract work must name its backend write scope explicitly.
- Shared coordinator docs and contracts require explicit assignment.

## Last Completed Batch

- Design:
  `docs/superpowers/specs/2026-07-09-profile-content-surfaces-design.md`
- Source plan:
  `docs/superpowers/plans/2026-07-09-profile-content-surfaces.md`
- Completed task: Task 1 proved `User.posts`, `User.storyFeed`, and
  `User.replayFeed` cursor ordering, filtering, and authorization.
- Write scope: `test/live_canvas_gql/relay/node_queries_test.exs`.
- Conditional production scope: `lib/live_canvas/feed.ex` and
  `lib/live_canvas_gql/accounts/user_resolver.ex` only if the focused test
  reproduces a real defect.
- Result: deterministic profile connection tests pass without widening viewer
  visibility or accepting raw IDs; no backend production change was required.

## Verification

- `mix format --check-formatted test/live_canvas_gql/relay/node_queries_test.exs`
- `mix test test/live_canvas_gql/relay/node_queries_test.exs`
- Result: 30 tests, 0 failures.
- Repository-wide formatting remains red only in seven unrelated baseline
  files: `config/runtime.exs`, `lib/live_canvas/dev/seed_data.ex`,
  `test/integration/live/end_session_recording_atomicity_test.exs`,
  `test/live_canvas/chat_test.exs`,
  `test/live_canvas/dev/seed_data_test.exs`,
  `test/live_canvas_gql/accounts/account_queries_test.exs`, and
  `test/live_canvas_web/telemetry_test.exs`.

## Next Action

No backend implementation batch is active. Review
`docs/superpowers/plans/2026-07-11-media-post-publishing.md`; after approval,
promote Task 1's MIME allowlist validation, storage-verified upload finalization,
processed-only attachment, and GraphQL schema-privacy work.

## References

- Mobile lane: `docs/plans/mobile/NOW.md`
- Completed Batch 1 plan:
  `docs/superpowers/plans/2026-07-09-reversible-social-controls.md`
- Queued Batch 4 plan:
  `docs/superpowers/plans/2026-07-11-live-chat-message-controls.md`
- Queued Batch 5 plan:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
