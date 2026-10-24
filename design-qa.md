# Brand design QA — journal

final result: passed

## Findings and comparison history

P2: missing compact journal identity; nested media frames; unlabeled search/password; empty photo alternatives. Added text masthead with existing Editor/logout action, removed decorative media frames, added labels and existing-caption alternatives.

Initial browser review: 2026-10-22T19:01:27Z, blocked for the P2 findings above. Revised review: 19:09Z; final source capture: 19:15Z. The final combined source/implementation image was opened and compared visually after fixes. No actionable P0/P1/P2 remains within this brand implementation review. This is not a comprehensive accessibility or security audit.

## Visual truth and normalization

Source visual truth: `/Users/justin/repos/brand-review/2026-10-22/08-index-simplified-no-marks.png` (1448×1086px board). Rendered source: `f2d1102`. Local URL: `http://127.0.0.1:4424/`. State: public, light theme, actual application content. The board is a family art direction containing several compact surfaces; the real application retains its content density and features. It is not treated as a pixel-identical page specification.

Full-view comparison: [brand-rollout/qa/after-comparison.png](brand-rollout/qa/after-comparison.png); earlier blocked comparison: [before](brand-rollout/qa/before-comparison.png). Both artifacts are in the same comparison image at700px column width, scaled proportionally. Implementation desktop crop is1440×900 CSS/pixels atDSF1. Focused typography/navigation inspection uses the full-resolution [desktop crop](brand-rollout/qa/desktop-top.png), computed-font evidence and390px capture; no separate region composite was needed because the entire top viewport is readable in the full-resolution crop.

## Required fidelity surfaces

- Fonts: local Inter provides compact sans navigation/interface text. Source Serif4 is retained for reading headings where applicable; sans-only lists/feeds and functional dashboard headings are intentional. Modest22px identity, no leading title icon/character, and no giant hero. Font loading and wrapping were inspected visually and through computed styles.
- Spacing/layout: warm open page, fine rules and restrained hierarchy match the board. Actual long descriptions, feed entries, docs collections and functional data grouping remain. No clipping or document overflow at320,390,768,1440px. Functional dashboard KPI cards/chart are intentionally retained.
- Color: ink/paper/stone base and small slate accents; no blue page wash. Existing semantic status/chart colors remain meaningful. Focus treatment is visible; muted text and controls were checked in rendered views.
- Image/assets: no added decorative photography or title mark. Existing public media remains authentic, without ornamental framing. Photos use existing author captions as alternatives with fallback; no invented image descriptions. Existing functional charts/icons are preserved.
- Copy/content: actual routes, records, article bodies, feed content, metrics, integrations and product names remain. The approved board's short sample labels do not replace application content. No implementation instructions appear as product copy.

## Browser verification and evidence

User explicitly approved Chromium/Playwright fallback. Guarded runners used `JNAP_MANUAL_BROWSER_ALLOW=1` and `--manual-allow-browser`. Browser-rendered evidence: [390px](brand-rollout/qa/render-390.png), [768px](brand-rollout/qa/render-768.png), [1440px](brand-rollout/qa/render-1440.png), [320px](brand-rollout/qa/render-320.png), [machine evidence](brand-rollout/qa/browser-evidence.json).

Keyboard focus, public navigation and console/page errors checked: no captured console errors or page errors. Search and Photos200; pagination12→24; 4 photos, zero empty alternatives. Synthetic login200 and composer shown; unauthenticated post401. No posts created.

200% effective reflow: [capture](brand-rollout/qa/effective-200-percent.png),720×450 CSS viewport with deviceScaleFactor2 (1440×900 physical pixels), no document overflow. Headless keyboard zoom did not change viewport/DPR; this is an explicit effective CSS/DSF emulation, not a claim of native browser-UI zoom testing. Native UI zoom is a remaining manual coverage limitation.

npm run build -- --webpack: passed on Next16.4.1. Configured DB readiness is read-only; no migrations executed. Synthetic login changes cookies only; no content or financial/integration writes were performed.

## Implementation checklist

- [x] Compare approved source and render together.
- [x] Fix earlier P2 findings and recapture same state.
- [x] Review typography, spacing, colors, media and actual copy.
- [x] Verify responsive sizes, focus and core public/auth boundaries.
- [x] Production build and durable screenshot evidence.

## Follow-up polish

P3: native browser-UI zoom can be checked manually beyond the recorded effective200% reflow. No further cosmetic expansion is required for this rollout.

## Timestamp hydration follow-up

Production-only timezone drift found after rollout: metadata locale/timezone varied between SSR and clients (React418). Fixed by using shared explicit en-US/UTC labels. Actual UTC-server production build versus New York, Tokyo and Berlin browser contexts now has identical labels and zero hydration/console errors.390px captures remain within viewport. The same modest type/layout is preserved; UTC is now truthfully visible. See `brand-rollout/hydration-followup.md` and `brand-rollout/qa/hydration/`. Scoped final result remains passed; production verification follows deployment of this separate PR.


## 2026-10-23: Shared midpoint palette

Final result: passed

Apply midpoint red (#d01527) to text accents, hover/focus/selection states, keeping green (#356349) exclusively as the native scroll canvas behind a full-height paper page surface. Screen-only overrides preserve print styling and published PDF files. Existing dark modes retain readable contrast with a lighter red text variant. No application data, destinations, authentication, or runtime dependencies changed.

The production build/static checks pass using the repository lockfile. Browser checks at 320, 390, and 1440 pixels verify palette tokens, green root/body canvas, paper surface without exposed green bands, selection color, and no page overflow or runtime exceptions. Screenshots were inspected. Existing dark modes also pass. The news reader includes narrow-screen wrapping for article controls/text found during this review; hiring CTA text retains sufficient contrast on red.

Local build/browser evidence is retained outside this repo in the rollout directory. Production status and screenshots are recorded after release; this local QA result does not assert production has already changed.
