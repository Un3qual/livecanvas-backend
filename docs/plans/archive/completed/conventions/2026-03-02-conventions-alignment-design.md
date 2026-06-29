# Conventions Alignment Design

> **For Claude:** This design was approved before implementation. Use it as the decision record for the March 2, 2026 conventions pass.

**Goal:** Align the current backend with the requested security, schema, typing, and API conventions while separating immediate low-risk changes from larger refactors that need dedicated plans.

**Architecture:** Apply narrow, low-risk baseline changes in-place now: stronger token hashing, stricter type-checking hooks, and concise repository guidance. Treat schema-wide identity changes, namespace renames, phone OTP delivery scaffolding, and Relay-first GraphQL reshaping as planned migrations because they cross many files and require phased rollout.

**Quick Changes**

- Switch token hashing from SHA-256 to SHA3-256.
- Keep `:utc_datetime_usec` as the canonical timestamp type and document it.
- Add a Dialyzer baseline to the local precommit flow and document the requirement for typespecs.
- Add concise agent-facing and human-facing convention docs.

**Planned Changes**

- Default primary-key convention: `bigint` plus `:entropy_id` (`uuidv7`) for normal tables.
- Explicit exception rule: tables like `user_tokens` may use pure `uuidv7`.
- Rename `LiveCanvas*` modules to `LC*`.
- Add a lightweight phone OTP/SMS fake service that logs SMS payloads now and leaves a clear seam for future Oban/Twilio integration.
- Move the GraphQL schema toward actual Relay-first shapes: nodes, global IDs, connections, edges, and Relay-friendly mutations.

**Verification**

- Follow red/green for code changes.
- Commit the quick baseline separately from the generated implementation plans.
