# Backend Lane NOW

Last reviewed: 2026-07-11
Status: Batch 4 Live-Chat Message Controls Task 1 next

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Cross-lane mobile contract work must name its backend write scope explicitly.
- Shared coordinator docs and contracts require explicit assignment.

## Last Completed Batch

- Source plan:
  `docs/superpowers/plans/2026-07-11-media-post-publishing.md`
- Completed task: Task 1 completed the media upload lifecycle contract.
- Result: uploads are write-once and storage-verified before idempotent durable
  processing; attachments require owner-scoped processed assets; GraphQL keeps
  storage and owner internals private.

## Verification

- Original focused backend lifecycle suite: 239 tests, 0 failures.
- Review-focused backend suite: 128 tests, 0 failures.
- Full backend regression suite: 971 tests, 0 failures, 1 excluded.
- `mix typecheck` and `mix compile --warnings-as-errors` passed.
- Touched-file formatting and `git diff --check` passed.
- Authenticated upload-ticket binding, terminal-state race safety, and
  field-level `publicUrl` authorization have dedicated regression coverage.
- Exported `mobile/schema.graphql` contains `finalizeMediaUpload` and omits
  `MediaAsset.ownerId` and `MediaAsset.storageKey`.
- Repository-wide formatting remains red only in three unrelated baseline
  files: `lib/live_canvas/dev/seed_data.ex`, `test/live_canvas/chat_test.exs`,
  and `test/live_canvas_web/telemetry_test.exs`.

## Current Batch

- Source plan:
  `docs/superpowers/plans/2026-07-11-live-chat-message-controls.md`
- Current task: Task 1, Prove Backend Authorization And Broadcast Semantics.
- Write scope: chat mutation/channel tests plus the action-specific host-remove
  authorizer and resolver paths named in the source plan.
- Done condition: the authorization/broadcast matrix passes, ended sessions
  cannot remove chat rows, touched types remain current, and typecheck passes.

## Next Action

Execute Task 1 from the Batch 4 source plan, then hand the verified mutation and
broadcast contract to mobile Tasks 2-4.

## References

- Mobile lane: `docs/plans/mobile/NOW.md`
- Completed Batch 3 plan:
  `docs/superpowers/plans/2026-07-11-media-post-publishing.md`
- Queued Batch 5 plan:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
