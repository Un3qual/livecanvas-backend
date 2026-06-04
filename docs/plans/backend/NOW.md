# Backend Lane NOW

Last reviewed: 2026-06-03
Status: idle

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Do not edit `mobile/` or `docs/plans/mobile/**` from this lane.
- Shared coordinator docs and shared contracts require explicit assignment.

## Current Batch

None. No unblocked backend implementation batch is currently selected.

## Why Idle

- `GEN-001` chat timeline/event-object redesign is implemented and verified.
- Backend code-quality cleanup is complete for all valid or partially valid items.
- No backend follow-up has been promoted into this lane yet.

## Resume Path

When backend work is explicitly requested:

1. Check `docs/plans/INDEX.md` for registry context.
2. Check the relevant backend track or source plan if one is named.
3. Use `ARCHITECTURE.md` only when product priority or architecture direction is
   unclear.
4. Create or promote one concrete backend implementation plan.
5. Update this file with the first executable batch.

Do not reopen completed cleanup, `GQL-*`, `SOCK-*`, `LIVE-001`, `WEB-001`,
`GEN-002`, `DOC-001`, or `GEN-001` work unless the user explicitly asks for a
follow-up adjustment.

## Verification

No backend verification is required while this lane is idle. Future backend
implementation batches must define focused tests and run `mix typecheck` when
typed code is touched.

## References

- Cleanup inventory: `docs/plans/backend/2026-05-22-code-quality-cleanup.md`
- GEN-001 design:
  `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-redesign.md`
- GEN-001 implementation:
  `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-implementation-plan.md`
