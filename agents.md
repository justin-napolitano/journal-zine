# Agents Guide

## Mission
Ship the invite-only social network outlined in `plan.md` with a playful Facebook-meets-Instagram experience: trustworthy gated access, expressive profiles, and infinite-scroll media feed.

## Operating Principles
1. **Protect the Circle** – Any feature must respect invite-only flows (enforce invite tokens across auth, posting, and sharing).
2. **Feed First** – Prioritize performance/UX of the scrolling feed before ancillary surfaces.
3. **Small Iterations** – Land vertical slices (invite redemption, posting + rendering, reactions, etc.) with tests + instrumentation.
4. **Document As You Build** – Update `docs/` + `/plan.md` as architecture or scope evolves.
5. **Quality Loop** – Prefer unit + integration tests + linting; run `npm run lint && npm run test` when relevant.

## Workflow Expectations
- Keep `plan.md` as the single source of truth for roadmap/milestones; adjust via PRs before coding major pivots.
- When picking up work, create/extend a task checklist in the PR description + note which phase/epic (A-D) it maps to.
- Surface risks quickly; open a `docs/journal-dev-notes-and-maintenance.md` entry for any infra or process gotchas.
- Use feature flags or environment toggles when adding beta-only functionality (e.g., DM rollout).

## Technical Guardrails
- Next.js App Router with TypeScript everywhere; prefer server components unless interactivity demands client components.
- Data layer should default to Postgres via an ORM (Prisma/Drizzle). Migrations must be deterministic and reviewed.
- Infinite scroll must rely on keyset pagination APIs; avoid offset pagination once real data volume arrives.
- Background jobs (invite expiration, recap emails) must be idempotent and observable (logs + metrics hook).
- Accessibility is non-negotiable: caption uploads, keyboard nav, reduced motion fallbacks.

## Collaboration Notes
- Always leave breadcrumbs: link figma/mock references, mention metrics targets, and quote any open questions (see `plan.md` §7) in the PR/issue body.
- Encourage users with leading questions when scope is fuzzy ("Which circles should see this post?", "Should invites regenerate weekly?").
- If external integrations (Bluesky/Mastodon) must remain, capture assumptions before touching existing adapters.

## Ready Checklist Before Merge
- Tests + lint pass locally.
- Feature toggles/invite requirements validated on a fresh account.
- Docs + copy updates included.
- Demo notes or Loom summary attached when UI/UX shifts.
