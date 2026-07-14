# Mobile Lane NOW

Last reviewed: 2026-07-14
Status: local release-candidate gates pass; operator and device QA pending

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Current Gate

- Source checklist:
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`
- Batch 5 source plan, now complete:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
- Current scope: local entry gates are complete; the checklist's manual
  one-host/one-viewer preview-build and device QA remains pending.
- Local verification: `pnpm test:quality`, `pnpm typecheck`, frozen pnpm
  dependency restore, and patch hygiene pass with 552 Vitest and 165 Jest tests.
- Invite entry requirement: target `EXPO_PUBLIC_APP_ORIGIN` must match backend
  `LIVE_CANVAS_PUBLIC_ORIGIN`; manual evidence must exercise an actual delivered
  invite through the HTTPS landing and native app handoff.
- Done condition: every launch blocker is cleared or explicitly removed from
  release scope, with manual evidence recorded in the checklist.

## Deferred Scope

- Native address-book import, bulk contact upload, multi-viewer scale, store
  submission, and other checklist-deferred follow-up remain out of scope.

## Next Action

Have the release operator confirm EAS project linkage; the target API,
websocket, and public-app origins; the matching backend public origin; an
installable preview artifact; separate host/viewer identities; an unmatched
recipient inbox; and physical devices. Then run the checklist's manual QA. Do
not run remote EAS commands without explicit approval.
