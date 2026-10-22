# Journal timestamp hydration follow-up

Phase D quality follow-up. Production browser QA found React418 when the UTC server and a browser in another locale/timezone rendered post metadata. PostCard used host-default locale/timezone.

- [x] Consolidate PostCard onto shared timestamp formatter.
- [x] Specify en-US and UTC, showing UTC explicitly.
- [x] Verify timezone/locale independence, production build and cross-timezone browser hydration.

No auth, API, persisted timestamps, media, integration or schema behavior changes. No SSR disabling or hydration-warning suppression. Reference: https://react.dev/errors/418 .

Validation: `node --test scripts/test-post-date.mjs` (2 tests), `npm run lint`, and `TZ=UTC npm run build -- --webpack` pass. Approved Chromium production-server regression compared JavaScript-disabled SSR labels to hydrated browser labels in en-US/New York, ja-JP/Tokyo, de-DE/Berlin: all12 labels identical and explicitly UTC, zero console/page errors,390px document width390. Existing live deployment reproduced418 in all three contexts before this patch. Durable before/after JSON and final browser PNGs: `brand-rollout/qa/hydration/`. No content writes or migration commands executed.

Root will review and separately stage/promote this follow-up PR; existing production is not claimed fixed until rollout verification.
