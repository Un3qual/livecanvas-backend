# Mobile App Overview Design

Approved on 2026-03-18.

Day-to-day mobile execution ordering should live in `docs/plans/mobile/TRACK.md` and `docs/plans/mobile/NOW.md`, with `docs/plans/NOW.md` acting as the coordinator dashboard. Use this document for scope, architecture direction, and the top-level planning breakdown.

This document captures the approved overview for the LiveCanvas mobile frontend planning set:

- an Expo app whose code will live in `mobile/`
- GraphQL plus Relay for durable reads and writes
- Phoenix Channels for live session and chat realtime flows
- Phase 1 product scope centered on auth, simple profiles, and mostly feature-complete live streaming plus chat

## Scope Assumptions

- The first mobile target is native iOS and Android through Expo; web is not part of this planning pass.
- Backend contracts remain the source of truth for durable data and authorization behavior.
- "Simple profiles" means enough profile and relationship surface to support identity, privacy, follow state, and entering live sessions, not a full profile-customization system.
- "Mostly feature-complete live and chat" means hosts and viewers can complete the main live-session flows end to end, even if launch polish, advanced moderation, or edge-case hardening still need later passes.
- The app should align to the published mobile GraphQL contracts in `docs/contracts/mobile-graphql-phase2.md` and `docs/contracts/mobile-graphql-chat-history.md`.

## Shared Design Decisions

### Client Architecture

- The mobile app should be a modular Expo client with feature folders layered on top of a small shared foundation: app shell, Relay environment, auth/session handling, Phoenix Channel client, UI primitives, and device/media services.
- Durable data should flow through GraphQL plus Relay. The frontend should not invent parallel REST paths for product surfaces already modeled in the backend contracts.
- Realtime live-session and chat updates should use Phoenix Channels rather than waiting for GraphQL subscriptions that do not exist in the approved backend architecture.
- Local state should stay focused on UI state, device capabilities, media pipeline state, and transient reconnection state. Durable server state should stay in Relay wherever possible.

### Expo And Native Capability Boundary

- Expo is the approved app framework, but the live-broadcasting stack may still require a custom dev client or `expo prebuild`.
- Future detailed planning must explicitly validate the native module strategy for camera, microphone, audio session handling, secure storage, deep links, and the live media transport layer before implementation starts.
- If fully managed Expo cannot support the required live media path, the project should still stay Expo-led rather than falling back to an unrelated native app structure.

### Product Delivery Order

Recommended sequencing:

1. App foundations and shell
2. Relay, auth, and session lifecycle
3. Simple profiles and relationship-aware navigation
4. Live discovery and viewer watch flow
5. Host broadcast flow
6. Chat realtime plus retained history
7. Release hardening and QA expansion

This ordering gets the platform and account model stable before tackling the highest-risk media and realtime surfaces.

## Planning Breakdown

### 1. App Foundations

#### 1.1 Expo Runtime, Build Strategy, And Project Skeleton

- [ ] Decide whether the live feature set can stay within managed Expo or requires a custom dev client / `expo prebuild` from the start.
- [ ] Define the initial `mobile/` directory layout, including routes, feature modules, shared UI, Relay codegen output, channel client code, assets, and test folders.
- [ ] Choose the build and release path for local development, simulator/device QA, internal distribution, and production submission.
- [ ] Define environment separation for local, staging, and production GraphQL/channel endpoints plus app config.
- [ ] Write the follow-up detailed plan for bootstrapping the Expo workspace and baseline toolchain.

#### 1.2 App Shell, Routing, And Global Providers

- [ ] Choose the routing model. Expo Router is the default recommendation unless a specific mobile constraint makes plain React Navigation a better fit.
- [ ] Define top-level route groups for unauthenticated entry, authenticated app shell, live-session modals/screens, and profile/navigation entry points.
- [ ] Plan the provider stack for Relay, auth/session, channel lifecycle, theming, safe-area handling, and global error boundaries.
- [ ] Define app start behavior for splash/loading, stored-session hydration, forced logout, and deep-link entry into profiles or live sessions.
- [ ] Write the follow-up detailed plan for the app shell and route architecture.

#### 1.3 Design System And Shared UI Primitives

- [ ] Define design tokens for color, typography, spacing, elevation, and touch targets suitable for a media-heavy mobile UI.
- [ ] Choose the shared component baseline for buttons, inputs, avatars, lists, modals, toasts, skeletons, and error states.
- [ ] Define accessibility requirements for text scaling, screen-reader labels, focus order, contrast, and motion reduction.
- [ ] Plan reusable live/chat-specific primitives such as viewer counters, badges, composer affordances, and message/system-event rows.
- [ ] Write the follow-up detailed plan for the design system and shared components.

#### 1.4 Tooling, Quality Gates, And Developer Workflow

- [ ] Set TypeScript, linting, formatting, testing, and Relay codegen standards for the future `mobile/` app.
- [ ] Define how schema updates and generated Relay artifacts will be produced and checked into the repo.
- [ ] Decide the baseline local developer workflow for booting the app against backend environments and seeded test accounts.
- [ ] Identify the smallest useful CI checks for the mobile workspace once code exists.
- [ ] Write the follow-up detailed plan for tooling and developer workflow.

### 2. Data Layer And Server Integration

#### 2.1 GraphQL Contract Intake And Relay Conventions

- [ ] Inventory the backend GraphQL surfaces Phase 1 mobile actually needs, starting from auth, social/profile reads, live-session mutations, and chat history.
- [ ] Define how Relay fragments, refetch queries, nodes, and connections should be organized across the mobile codebase.
- [ ] Decide the codegen and schema refresh workflow so the frontend stays aligned to backend contracts without manual drift.
- [ ] Establish pagination conventions for follower/following lists, pending follow requests, and retained chat history.
- [ ] Write the follow-up detailed plan for Relay architecture and GraphQL integration.

#### 2.2 Authenticated Network Layer

- [ ] Design the GraphQL network layer with access-token injection, refresh-token handling, logout on unrecoverable auth failure, and request retry rules.
- [ ] Define secure token storage and session restoration behavior for cold start, app resume, and token rotation.
- [ ] Decide how mobile should treat backend `UserError` payloads versus transport failures versus authorization fallbacks such as `null` nodes or empty connections.
- [ ] Plan request cancellation, stale-screen handling, and in-flight mutation behavior during navigation changes.
- [ ] Write the follow-up detailed plan for network/auth integration.

#### 2.3 Phoenix Channel Client

- [ ] Define the mobile channel client boundary for connection lifecycle, auth params, topic join/leave, event subscriptions, and reconnect behavior.
- [ ] Decide how the channel client will integrate with Relay-managed durable state without duplicating server data ownership.
- [ ] Plan foreground/background handling, connectivity loss, and token refresh interactions for active realtime sessions.
- [ ] Define debug and test seams for channel traffic before implementation starts.
- [ ] Write the follow-up detailed plan for Phoenix Channel integration.

#### 2.4 Local Persistence And Cache Policy

- [ ] Decide what, if anything, should be persisted locally beyond secure auth tokens: Relay store snapshots, draft chat input, dismissed UI affordances, or recent session state.
- [ ] Define invalidation and refresh behavior for app foregrounding, pull-to-refresh, mutation completion, and session transitions.
- [ ] Plan how to deduplicate realtime events against Relay-fetched records, especially for chat history and live-session state.
- [ ] Define the minimum offline behavior the Phase 1 app should support without overcommitting to full offline-first architecture.
- [ ] Write the follow-up detailed plan for local persistence and cache policy.

### 3. Authentication And Account Lifecycle

#### 3.1 Auth Provider Scope

- [ ] Choose the Phase 1 provider subset from the backend-supported auth surface: password, magic link, Google, Apple, and passkey.
- [ ] Define whether all selected providers ship at launch or whether some are sequenced behind the first mobile release.
- [ ] Map each chosen provider onto Expo-compatible UX and native dependency requirements.
- [ ] Confirm any provider-specific backend or app-store requirements that affect the plan.
- [ ] Write the follow-up detailed plan for auth provider support.

#### 3.2 Sign-Up, Login, And Session Recovery UX

- [ ] Design the screen flow for sign-up, login, challenge start, credential submission, and successful session bootstrap.
- [ ] Define how the app distinguishes account creation from login while still using the unified backend mutation surface.
- [ ] Plan recovery states for expired links/tokens, invalid credentials, revoked refresh tokens, and missing network connectivity.
- [ ] Decide how much account onboarding is required before the user reaches the signed-in shell.
- [ ] Write the follow-up detailed plan for auth UX and session recovery.

#### 3.3 Viewer Bootstrap And Account State Handling

- [ ] Define the initial signed-in bootstrap query set for the authenticated viewer, including relationship-aware UI state required by the first screens.
- [ ] Plan suspended, unauthorized, partially configured, or otherwise restricted account behavior in the app shell.
- [ ] Decide how logout should clean up Relay state, channel connections, and locally persisted data.
- [ ] Define app-resume behavior when the stored session becomes invalid while the user is away.
- [ ] Write the follow-up detailed plan for viewer bootstrap and account-state handling.

### 4. Profiles And Social Basics

#### 4.1 Viewer Profile Surface

- [ ] Define the minimum Phase 1 viewer profile contents and confirm which fields are already supported by backend APIs versus which need later backend work.
- [ ] Decide what editing capability is required for launch versus what can stay read-only in the first mobile pass.
- [ ] Plan the UI for privacy mode, follower/following counts, pending follow requests, and entry into the user's current or recent live session.
- [ ] Define fallback and loading states for sparse or incomplete profile data.
- [ ] Write the follow-up detailed plan for the viewer profile surface.

#### 4.2 Other-User Profile Surface

- [ ] Design the minimal public/private profile view for another user, including avatar/identity, privacy status, follow affordances, and live-session entry points.
- [ ] Define how the app should present private-account restrictions, pending follow-request states, muted relationships, and unavailable content.
- [ ] Plan profile-driven navigation into live sessions, chat history, or replay surfaces only where the backend contract supports it.
- [ ] Clarify how blocked or otherwise unauthorized users should appear in the UI without leaking protected state.
- [ ] Write the follow-up detailed plan for other-user profiles.

#### 4.3 Relationship Actions And Social Inbox

- [ ] Inventory the relationship actions the mobile app needs on day one: follow, unfollow, request follow, accept/decline request, and mute state display.
- [ ] Define where inbound follow requests live in the app information architecture and how they connect back to profiles.
- [ ] Plan optimistic versus server-confirmed updates for follow state, follower counts, and pending requests.
- [ ] Decide which social controls are out of scope for the initial mobile release.
- [ ] Write the follow-up detailed plan for relationship actions and the social inbox.

### 5. Live Discovery And Session Entry

#### 5.1 Entry Surfaces Into Live Sessions

- [ ] Decide the minimum set of viewer entry points for live sessions: profile entry, direct link, live-now list, following feed, or other lightweight discovery surfaces.
- [ ] Map those entry points to existing backend feed and live-session contracts so the frontend does not invent unsupported discovery models.
- [ ] Define empty, ended, unauthorized, and loading states for each entry path.
- [ ] Clarify whether replay discovery is part of the first mobile planning wave or a later follow-up.
- [ ] Write the follow-up detailed plan for live discovery and session entry.

### 6. Live Viewing Experience

#### 6.1 Watch Screen Architecture

- [ ] Design the watch screen layout around video playback, host identity, session state, chat visibility, and core action affordances.
- [ ] Decide how the watch screen binds Relay-fetched session data to realtime channel updates without conflicting ownership.
- [ ] Plan how the screen transitions between starting, live, ended, and unavailable session states.
- [ ] Define the baseline UX for join/leave lifecycle, viewer counts, and session end handling.
- [ ] Write the follow-up detailed plan for the viewer watch screen.

#### 6.2 Playback, Device State, And Interruptions

- [ ] Choose the playback stack compatible with the selected live transport and Expo boundary.
- [ ] Define orientation, keep-awake, audio-session, headphone/speaker, mute, and interruption behavior during viewing.
- [ ] Plan app background/foreground transitions while a viewer is in a live session.
- [ ] Decide what degraded-network states should be surfaced to users during playback.
- [ ] Write the follow-up detailed plan for viewer playback and device behavior.

#### 6.3 Authorization, Reconnect, And Fallback Behavior

- [ ] Map backend authorization outcomes into mobile watch-screen UX for private sessions, muted hosts, suspended viewers, and ended sessions.
- [ ] Define reconnect behavior when the channel drops but the durable session still exists.
- [ ] Plan what the app should do when a session is removed or becomes unauthorized mid-watch.
- [ ] Define when to fall back to durable GraphQL refetch versus waiting for channel recovery.
- [ ] Write the follow-up detailed plan for live-view authorization and reconnect behavior.

### 7. Host Broadcast Experience

#### 7.1 Native Media Transport Feasibility

- [ ] Investigate the concrete mobile broadcast transport required by the backend live architecture and confirm the client SDK/native-module implications.
- [ ] Determine whether the host broadcast path can be implemented cleanly inside Expo with plugins/prebuild or whether it requires a stricter native boundary from the start.
- [ ] Identify device-permission, camera pipeline, audio routing, and background-state constraints that materially affect product scope.
- [ ] Document any backend gaps or infrastructure assumptions the mobile host flow depends on before writing implementation plans.
- [ ] Write the follow-up detailed plan for the media transport and native capability layer.

#### 7.2 Host Preflight And Go-Live Flow

- [ ] Design the host flow for session setup, permission grants, camera/mic preview, visibility selection, and session creation before going live.
- [ ] Map the UX onto the existing live lifecycle mutations such as start, go live, and end.
- [ ] Define failure recovery for permission denial, transport setup failure, and session-creation errors.
- [ ] Decide which preflight settings are required for launch and which can wait.
- [ ] Write the follow-up detailed plan for host preflight and go-live UX.

#### 7.3 In-Session Host Controls

- [ ] Define the minimum host controls for camera switching, mute/unmute, chat visibility, participant awareness, and ending the session.
- [ ] Plan degraded-network, interruption, and reconnect behavior for the broadcaster path.
- [ ] Decide how host-side moderation affordances appear if message removal ships in the first mobile pass.
- [ ] Clarify which advanced creator tools are intentionally out of scope.
- [ ] Write the follow-up detailed plan for in-session host controls.

#### 7.4 Post-Live And Recording Flow

- [ ] Decide whether recording attachment and replay handoff are part of the initial mobile host experience or a later follow-up.
- [ ] If replay is in scope, map the user flow onto the existing backend recording-linkage behavior.
- [ ] Define the host-facing end-state UX after a session ends, including failure or partial-success cases.
- [ ] Clarify whether post-live sharing or management needs to exist in the first mobile release.
- [ ] Write the follow-up detailed plan for post-live and recording behavior.

### 8. Chat Experience

#### 8.1 Realtime Chat Stream

- [ ] Design how chat send/receive events flow through the mobile channel client while keeping Relay as the durable source for retained history.
- [ ] Define message composer UX, rate-limit handling, send pending/error states, and disabled states when chat is unavailable.
- [ ] Plan message rendering for user messages, system events, moderation redactions, and sparse sender data.
- [ ] Decide how chat visibility integrates with the watch screen on both host and viewer paths.
- [ ] Write the follow-up detailed plan for the realtime chat stream.

#### 8.2 Retained Chat History And Pagination

- [ ] Map the retained chat-history contract onto mobile scrolling behavior, including initial load, older-message pagination, and newer-message catch-up.
- [ ] Define how realtime events merge with or refetch against `LiveSession.chatMessages` without duplicate rows or order drift.
- [ ] Plan ended-session history behavior so the UI stays consistent after the live transport stops.
- [ ] Clarify how unauthorized or empty-history cases should look in the chat UI.
- [ ] Write the follow-up detailed plan for retained chat history and pagination.

#### 8.3 Chat Moderation And Safety Controls

- [ ] Decide whether host-side message removal belongs in the first mobile launch scope.
- [ ] If moderation is included, define the host UX, confirmation flows, and post-removal rendering states.
- [ ] Clarify which safety/reporting features are explicitly out of scope for the first pass.
- [ ] Map moderation outcomes to backend channel and GraphQL behavior so the UI remains consistent.
- [ ] Write the follow-up detailed plan for chat moderation controls.

### 9. Testing, Verification, And Release Readiness

#### 9.1 Test Strategy

- [ ] Define the mobile test pyramid: unit tests, component tests, Relay/environment tests, channel integration tests, and device-level smoke coverage.
- [ ] Decide which flows need deterministic automated coverage first: auth, session restoration, watch flow, host go-live flow, chat send/receive, and profile relationship actions.
- [ ] Plan how backend contracts will be mocked or exercised in development and CI without creating an unrealistic frontend-only API layer.
- [ ] Define the minimum verification bar for each future mobile slice plan.
- [ ] Write the follow-up detailed plan for testing and verification.

#### 9.2 Beta Distribution And Store Readiness

- [ ] Define staging/beta distribution for internal testing and external testers.
- [ ] Plan app permissions copy, privacy disclosures, app icons/splash assets, and platform-specific submission requirements that may affect implementation.
- [ ] Decide the minimum crash-reporting and runtime diagnostics needed for a first launch without over-prioritizing ops over product delivery.
- [ ] Plan release checklists around auth, live permissions, and realtime regression testing.
- [ ] Write the follow-up detailed plan for beta distribution and release readiness.

## Non-Goals For This Planning Set

- full feed/product-surface parity with every backend domain
- advanced profile customization and layout editing
- billing, monetization, and creator payouts
- rich moderator/admin role systems beyond minimal host-owned controls
- full offline-first support for live or chat
- exhaustive launch hardening before the core live/chat product loop exists

## Open Questions For Follow-Up Planning

- Which auth providers are truly required for the first mobile launch?
- What live media transport and SDK combination is expected on mobile, and what native boundaries does it force inside Expo?
- What is the minimum live discovery surface required beyond profile-based entry?
- Which profile fields and edit capabilities are already supported by backend APIs versus still missing?
- Is replay creation/viewing in scope for the first mobile launch or explicitly deferred?
- How much host-side chat moderation should ship in the first pass?
