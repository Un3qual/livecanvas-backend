# LiveCanvas Backend Architecture Design

Approved on 2026-03-01.

This file captures the approved architecture decisions for the LiveCanvas
backend and serves as the dated design snapshot produced during the
brainstorming phase.

The canonical project-facing version of this design is maintained in
`ARCHITECTURE.md`.

## Approved Decisions

- Use a modular monolith in a single Phoenix application.
- Deploy one Elixir release per Kubernetes pod.
- Use PostgreSQL as the only persistent datastore.
- Never use Redis.
- Use GraphQL as the primary client API.
- Use REST only for webhook-style integrations.
- Use Phoenix Channels / WebSockets for chat, presence, and live session events.
- Use Membrane/WebRTC inside the main app runtime for v1.
- Preserve a clean path to add dedicated SFU/media pods later if needed.

## V1 Contexts

- `Accounts`
- `Social`
- `Content`
- `Live`
- `Chat`
- `Feed`

Deferred from v1:

- `Billing`
- `Geo`
- profile customization
- two-factor authentication

## Accounts Model

`Accounts` owns:

- `users`
- `user_identities`
- `email_addresses`
- `phone_numbers`
- `user_email_addresses`
- `user_phone_numbers`
- `user_contact_entries`
- `user_contact_entry_email_addresses`
- `user_contact_entry_phone_numbers`
- `user_tokens`

Key rules:

- `users` must not store denormalized primary email or phone columns.
- email and phone identity is modeled only through join tables.
- `user_tokens` uses a Postgres-generated UUIDv7 primary key.
- `user_tokens` stores a binary `secret_hash`, not raw token secrets.
- `user_identities` supports email, phone, Google, Apple, and passkey logins.

## Realtime And Storage Model

- Use OTP, PubSub, and Presence for ephemeral coordination.
- Persist durable facts in Postgres.
- Keep transient presence and session state in supervised processes.
- Store media metadata in Postgres and binaries in object storage.

## Security Model

- Authenticate into a single `user` account model.
- Authorize using layered checks: authentication, `Social`, then domain rules.
- Enforce private/public visibility consistently across feed, live, chat, and
  replay access.
- Treat `blocks` as stronger than follow relationships.

## Testing And Evolution

- Test contexts, GraphQL, Channels, and critical end-to-end flows.
- Scale the current monolith before splitting runtime responsibilities.
- Add billing, geo, and richer profile systems in later phases without
  rewriting the v1 context boundaries.
