# Next Five Product Batches Design

Date: 2026-07-09
Status: design approved; written-spec review pending
Owner: cross-lane coordinator

## Goal

Deliver five independently shippable product-completeness batches after the
completed July 8 account, contact-discovery, post-owner, profile-connection,
social-control, and moderation work. Keep release-candidate device QA deferred
until these five batches close, and promote backend work only where a verified
product contract requires it.

The sequence favors complete user loops over operational hardening:

1. reversible social controls
2. profile content surfaces
3. media post publishing
4. live-chat message controls
5. end-to-end contact invitations

## Sequencing Decision

The selected sequence closes one-way or missing interactions before expanding
growth mechanics. Reversible controls come first because the current mobile UI
can follow and block but cannot reverse those actions. Profile content follows
because the backend already exposes the required Relay connections, making it
a low-contract-risk way to turn profiles into useful destinations. Media
publishing then completes the existing content-creation contract. Chat controls
use existing ownership and host-moderation mutations. Contact invitations come
last because they require a real cross-platform landing and token-consumption
contract, not just a mobile button.

Each batch must close and pass its focused verification before the next batch
becomes executable. `docs/plans/NOW.md` remains the coordinator dashboard;
lane-specific `NOW.md` files own implementation state.

## Shared Architecture And Safety Rules

- Durable reads and writes remain Relay-first. Mobile treats every global ID
  and cursor as opaque.
- GraphQL node fetches, child fields, and mutation inputs re-apply viewer
  authorization. No raw foreign key becomes a visibility shortcut.
- Existing backend contracts are verified before being changed. A mobile-only
  batch promotes backend work only after a focused failure proves a mismatch.
- Mobile tests stay under `mobile/tests/**`.
- Public backend functions receive typespecs, and typed backend changes run
  `mix typecheck`.
- Persisted timestamps use `:utc_datetime_usec`. Persisted token secrets use
  the existing SHA3-based token machinery; raw tokens are never stored.
- Product errors are payload errors with viewer-safe copy. Clients do not infer
  hidden relationship, moderation, or ownership state from error differences.

## Batch 1: Reversible Social Controls

### Product outcome

A viewer can reverse a follow or a block from another user's profile without
learning whether that other user has independently blocked them.

### Design

- Add `LC.Social.unfollow_user/2` and `LC.Social.unblock_user/2` as
  viewer-scoped, idempotent operations.
- Add Relay mutations `unfollowUser` and `unblockUser`.
- Add a direction-safe `isBlockedByViewer` read. It reports only the viewer's
  outbound block and never reveals an inbound block.
- Show `Unfollow` only for an accepted outbound relationship.
- Show `Unblock` only when `isBlockedByViewer` is true.
- Refetch or update the confirmed relationship state after success. Pending
  actions block duplicate taps and stale responses cannot overwrite a newer
  profile state.

### Error and authorization behavior

Invalid or inaccessible IDs return the same viewer-safe not-found or
not-authorized shape. Repeating an unfollow or unblock succeeds from the
viewer's perspective. A blocked-by-target viewer receives no reversible action
that could expose the target's private relationship state.

### Done condition

Backend domain, GraphQL, Relay artifact, profile presentation, and component
tests cover success, idempotency, directionality, duplicate taps, and stale
response races.

## Batch 2: Profile Content Surfaces

### Product outcome

Viewer and other-user profiles expose their visible posts, active stories, and
replays instead of stopping at relationship summaries and a current live
session.

### Design

- Use existing `User.posts`, `User.storyFeed`, and `User.replayFeed` Relay
  connections.
- Add compact preview sections to both profile screens and a shared paginated
  content-list route for a selected content kind.
- Keep section pagination independent. Each section owns its cursor, loading
  state, retry state, and deduplication by opaque node ID.
- Reuse feed presentation for post, story-expiry, and replay metadata instead
  of introducing parallel formatting rules.
- Preserve backend ordering and visibility. The mobile client does not merge
  hidden content or reconstruct policy locally.

### Error and authorization behavior

An inaccessible profile renders the current unavailable state. A visible
profile with no visible content renders an empty section rather than exposing
whether content was filtered. A failed section can retry without clearing
other loaded sections.

### Done condition

Both profile types show tested previews and paginated lists for posts, stories,
and replays. Focused backend query tests confirm the existing contract; backend
code changes only if those tests reproduce a contract failure.

## Batch 3: Media Post Publishing

### Product outcome

A viewer can publish a standard post or story with one image or video, with
clear upload, processing, retry, and cancellation states.

### Design

- Add a native media picker for one supported image or video per post. Multiple
  attachments remain a later enhancement even though the backend accepts a
  list.
- Commit `requestMediaUpload`, perform the signed HTTP upload using the returned
  method and headers, and poll the viewer-scoped `mediaAsset` node until it is
  attachable.
- Model the workflow as explicit stages: selecting, requesting, uploading,
  processing, ready, submitting, succeeded, and failed.
- Use cancellation for in-flight upload and polling work. Retry requests a new
  signed upload when the previous URL may have expired.
- Submit `createPost` only after processing succeeds, passing the opaque media
  asset ID in `mediaAssetIds`.
- Keep text-only publishing unchanged and available.

### Error and authorization behavior

Reject unsupported MIME types and oversized local selections before upload
where the platform provides size metadata. Backend ownership and processing
checks remain authoritative. Failed uploads do not create a post; failed post
creation preserves the ready media asset for an explicit retry during the
current composer session.

### Done condition

Tests cover picker cancellation, signed-upload errors, URL expiry retry,
processing failure, auth loss, duplicate submission, and successful image and
video attachment. Existing backend media ownership tests remain green.

## Batch 4: Live-Chat Message Controls

### Product outcome

A message author can edit their active-session message, and the session host
can remove a message, with every connected viewer converging on the same
timeline state.

### Design

- Use existing `editLiveChatMessage` and `removeLiveChatMessageEvent` Relay
  mutations.
- Expose Edit only when the current viewer authored the message and the session
  remains editable under backend policy.
- Expose Remove only to the live-session host. Do not present general viewer
  deletion as supported behavior.
- Apply confirmed mutation payloads immediately, then reconcile with existing
  timeline update/removal channel events.
- Keep idempotent timeline merge rules so a mutation response and its realtime
  broadcast cannot duplicate, resurrect, or reorder a row.
- Preserve retained-history pagination and chat send behavior.

### Error and authorization behavior

Server authorization remains authoritative for every edit and removal. A stale
or already-removed event becomes a safe row-level error and refresh path. An
ended session disables editing; the UI does not speculate around a rejected
mutation.

### Done condition

Focused backend mutation/broadcast tests and mobile reducer, channel-lifecycle,
and component tests cover author edits, host removals, unauthorized actions,
ended sessions, duplicate events, and response/broadcast races.

## Batch 5: End-To-End Contact Invitations

### Product outcome

A viewer can invite an unmatched email contact, and the recipient receives a
working HTTPS link that lands in the app or authentication flow without
creating an implicit social relationship.

### Design

- Replace the hard-coded invalid invite URL with a configured public HTTPS
  origin and stable invite route.
- Validate the existing opaque contact-invite token by context, recipient,
  expiry, and hash. Invalid and expired links render one generic safe state.
- Preserve the invite token across sign-up or sign-in return routing and
  consume it at most once after successful authentication. Consumption also
  requires the authenticated account to own the token's normalized recipient
  email, so a forwarded or leaked link cannot be claimed by another account.
- Consumption records invite conversion only. It does not auto-follow, expose
  the inviter's private email, import the recipient's contacts, or bypass
  profile visibility.
- Enable the existing `deliverViewerContactInvite` mobile mutation only after
  the landing route is deployed and configured.
- Add explicit sent, retryable failure, and terminal invalid-recipient states
  to unmatched contact rows.

### Error and authorization behavior

Invite delivery remains authenticated and viewer-scoped. Public landing errors
do not distinguish malformed, expired, consumed, or unknown tokens. Delivery
and consumption are rate-limited using the existing mutation and auth abuse
controls. Tokens are deleted or otherwise made unusable after consumption.

### Done condition

Backend token, landing-route, redirect, configuration, and GraphQL tests cover
valid, expired, consumed, and tampered links. Mobile tests cover hidden-before-
configuration behavior, duplicate taps, success, retry, and safe auth return.

## Verification And Milestones

Each batch receives its own implementation plan and milestone commit. The
minimum gates are:

- focused backend domain and GraphQL tests for touched contracts
- `mix typecheck` for typed backend changes
- `bun run relay` when schema operations change
- focused mobile tests, `bun run typecheck`, `bun run typecheck:tests`, and
  `bun run test:quality`
- `git diff --check`

The coordinator closes one batch and promotes the next in the same milestone
only after the batch's done condition is met. Release-candidate manual device
QA follows Batch 5 and remains outside these five product batches.

## Explicitly Deferred

- native address-book access, permissions, and bulk contact upload
- multiple media attachments per post
- automatic follows or friend relationships from invite consumption
- general viewer deletion of chat messages
- compliance hard-delete enablement
- remote or authenticated EAS build and submission commands
- release-candidate device/account QA until all five batches close

## Implementation Planning Handoff

After written-spec approval, create a detailed implementation plan for Batch 1
only. Promote Batch 1 into both backend and mobile lane pointers with explicit,
disjoint write scopes and focused verification. Keep Batches 2-5 queued in the
coordinator design rather than marking them executable simultaneously.
