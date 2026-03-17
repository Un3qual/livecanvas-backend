# Chat Track Summary

Use this file to navigate the chat planning set without reopening the design doc on every execution turn.

## Goal

Deliver durable chat history first, then host-owned moderation, then typed system events on top of the same Relay `ChatMessage` model.

## Ordered Plans

1. `docs/plans/chat/2026-03-17-chat-history-query-api.md`
   - Status: completed
   - Completed batch: `Task 3`
   - Unblocks: the next moderation slice
2. `docs/plans/chat/2026-03-17-chat-moderation-actions.md`
   - Status: in progress
   - Current batch: `Task 2`
   - Start after: chat-history `Task 3` is complete
3. `docs/plans/chat/2026-03-17-chat-system-events.md`
   - Status: queued
   - Start after: moderation `Task 3` is complete unless dependencies are explicitly revalidated
   - First batch: `Task 1`

## Shared Constraints

- Preserve the Relay-first `ChatMessage` node and bidirectional connection.
- Keep channel and GraphQL payloads reconcilable so clients do not maintain two incompatible message shapes.
- Treat the design doc as rationale and the plan files as execution detail; use this track file for day-to-day ordering.

## Source Rationale

- Design: `docs/plans/chat/2026-03-17-chat-product-surface-design.md`
- Current pointer: `docs/plans/NOW.md`
