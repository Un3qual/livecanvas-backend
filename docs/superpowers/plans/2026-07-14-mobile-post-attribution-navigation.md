# Mobile Post Attribution and Author Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace generic post-author copy with the existing privacy-safe identity presentation and make every post/story author reachable through the correct profile route.

**Architecture:** Presentation stays pure, one profile navigation helper owns self-versus-other routing, and screens pass an author action into shared content cards. Existing GraphQL author IDs remain opaque; only the story-viewer query adds the current viewer ID needed to select the self route.

**Tech Stack:** Expo Router, React Native, TypeScript, Relay, Vitest, Jest/RNTL, pnpm, Node 26

## Global Constraints

- Do not add or expose public profile fields, change email authorization, or change the backend schema.
- Preserve author and viewer Relay IDs as opaque strings.
- Keep behavior tests under `mobile/tests/**`.
- Use pnpm public commands through the repository's Node 26 Nix environment.

---

### Task 1: Identity and Profile Destination Contracts

**Files:**
- Create: `mobile/src/profile/profileNavigation.ts`
- Modify: `mobile/src/content/contentPostPresentation.ts`
- Modify: `mobile/tests/content/contentPostPresentation.test.ts`
- Create: `mobile/tests/profile/profileNavigation.test.ts`

**Interfaces:**
- Produces: `formatPostAuthorPresentation(author: ContentPostAuthor)`.
- Produces: `profileHref(profileId: string, viewerId: string | null)` returning `/profile` for self and `/profiles/[id]` with the unchanged ID otherwise.

- [x] Write unit tests showing that an authorized email uses the established profile identity, missing email uses the neutral fallback, self routes to `/profile`, and other/missing-viewer routes preserve the opaque ID.
- [x] Run the two focused Vitest files and confirm the new expectations fail for the missing contracts.
- [x] Pass `post.author` into `formatPostAuthorPresentation/1`, reuse `formatProfileIdentity`, and implement `profileHref/2` without parsing or normalizing IDs.
- [x] Re-run the focused tests and both mobile TypeScript checks.
- [x] Mark Task 1 complete and commit the presentation/navigation milestone.

### Task 2: Author Actions on Shared Content Surfaces

**Files:**
- Modify: `mobile/src/content/ContentPostCard.tsx`
- Modify: `mobile/src/content/ContentSection.tsx`
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Modify: `mobile/src/profile/ProfileContentPreviewSection.tsx`
- Modify: `mobile/src/profile/ProfileContentListScreen.tsx`
- Modify: `mobile/tests/content/ContentPostCard.rntl.tsx`
- Modify: `mobile/tests/content/ContentSection.rntl.tsx`
- Modify: `mobile/tests/feed/FeedHomeScreen.rntl.tsx`
- Modify: `mobile/tests/profile/ProfileContentPreviewSection.rntl.tsx`
- Modify: `mobile/tests/profile/ProfileContentListScreen.rntl.tsx`

**Interfaces:**
- Consumes: `profileHref(profileId, viewerId)` from Task 1.
- Produces: required `onOpenAuthor(authorId: string)` on `ContentPostCard` and the post/story `ContentSection` variants.

- [ ] Add behavior tests that press the accessible author action, receive the unchanged author ID, route an owned author to `/profile`, and route another author to `/profiles/[id]` from Home and profile content.
- [ ] Run the five focused RNTL suites and confirm failures occur because author actions are absent.
- [ ] Render the author title as a minimum-touch-target `Pressable`, include a descriptive accessibility label, compare the new callback in the memo comparator, and forward it through `ContentSection`.
- [ ] In Home and both profile-content owners, create stable callbacks that push `profileHref(authorId, viewerId)` and pass them to every post/story card.
- [ ] Re-run the focused RNTL suites, lint, and both TypeScript checks.
- [ ] Mark Task 2 complete and commit the shared-surface milestone.

### Task 3: Dedicated Story Viewer and Lane Closure

**Files:**
- Modify: `mobile/src/content/story/storyViewerOperations.ts`
- Modify: `mobile/src/content/story/StoryViewerScreen.tsx`
- Modify: `mobile/tests/content/StoryViewerScreen.rntl.tsx`
- Regenerate: `mobile/src/__generated__/storyViewerOperationsQuery.graphql.ts`
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/mobile/TRACK.md`
- Modify: `docs/plans/NOW.md`
- Modify: `docs/superpowers/plans/2026-07-14-mobile-post-attribution-navigation.md`

**Interfaces:**
- Consumes: `profileHref(profileId, viewerId)` and the selected story's author ID.
- Produces: a dedicated story-viewer author-profile action with correct self/other routing.

- [ ] Add story-viewer behavior tests for owned and other-author routing, then run the focused suite and confirm it fails because the viewer ID/action are absent.
- [ ] Query `viewer { id }`, add the author-profile action, and route through `profileHref/2` without changing story pagination or privacy fetch behavior.
- [ ] Run Relay generation and the focused story/content suites.
- [ ] Run `pnpm test:quality`, `pnpm relay`, `nix flake check`, and repo-root `git diff --check`; confirm the worktree contains only intended changes.
- [ ] Close the mobile lane batch, retain operator/device QA as the next gate, mark this plan complete, and commit the verified closure milestone.
- [ ] Push the branch and open a non-draft pull request.
