# Invite-Only Social Network Plan

## 1. Product North Star
- **Promise**: A playful, tight-knit journal where invited friends swap life updates with quick photo dumps and micro-posts.
- **Differentiator**: Invite-only trust circle + effortless infinite scroll blending Facebook-style context (profiles, events, reactions) with Instagram-like visual rhythm.

## 2. Audience & Access
- Start with a small private beta seeded via invite codes.
- Each member gets a rotating pool of invite tokens; unused tokens expire to enforce scarcity.
- Profiles display "circle badge" counts so users feel rewarded for curating their network.

## 3. Experience Pillars
1. **Warm Onboarding**: Invite redemption, profile setup, suggested circles.
2. **Living Feed**: Infinite scroll of mixed media cards (text notes, photos, events) with subtle contextual grouping ("Justin posted 3 moments").
3. **Social Glue**: Reactions (quick emoji bar), threaded comments, lightweight DMs.
4. **Moments & Memories**: Optional daily recap email + "memory lane" resurfacing.

## 4. Feature Roadmap
### Phase A – Foundation (Weeks 1-2)
- Landing page describing the club; email capture waitlist.
- Auth + invite-code redemption gating every signup.
- Base entities: User, Invite, Post, MediaAsset, Reaction, Comment.
- Minimal profile editor (name, handle, avatar, bio, status emoji).

### Phase B – Feed & Posting (Weeks 3-4)
- Composer supporting text + up to 4 images, drag-drop upload, alt text.
- Infinite-scroll feed w/ server-side pagination + optimistic client cache.
- Privacy controls (circle-only default, future "public preview").
- Background job to score/rank feed (recency, affinity, content mix).

### Phase C – Social Loops (Weeks 5-6)
- Reactions + inline comments, @mentions, basic notifications center.
- Invite management dashboard (token count, history, resend).
- DM MVP (1:1 threads, read receipts later).

### Phase D – Delight & Growth (Weeks 7+)
- Events/reminders card type.
- Daily recap email + "memory lane" resurfacing widget.
- Analytics + admin console (moderation queue, audit log).

## 5. System Outline
- **Frontend**: Next.js App Router, React Server Components, Tailwind/shadcn UI, Suspense for streaming feed segments.
- **API**: Next.js route handlers or dedicated edge functions exposing REST/GraphQL for posts, invites, feed pagination, reactions.
- **Data**: PostgreSQL (Supabase/Neon) w/ row-level security, S3-compatible blob storage for media, Redis for feed fan-out + rate limiting.
- **Auth**: NextAuth + Magic links/SMS optional. Invite code required to create session.
- **Realtime**: WebSockets or Pusher-compatible layer for live comments/reactions.
- **Background**: Queue worker (Inngest/Temporal/Cron) for invite expirations, recap emails, memory resurfacing.

## 6. Experience Notes
- Feed card variants: text-first, photo grid, event summary, memory throwback.
- Color palette leaning playful (muted neons) w/ dark mode default.
- Micro-interactions: haptic-like button pops, progress pill while scrolling.

## 7. Risks & Open Questions
- Moderation for invite tree abuse.
- Storage costs for media-rich feed.
- Performance of infinite scroll on slower devices (need skeletons + virtualization).
- **To Clarify**:
  - Do we need multi-circle privacy (family vs friends) in MVP?
  - Preferred storage/infra stack already chosen (Supabase, PlanetScale, etc.)?
  - Any integrations with existing Journal features that must persist (Bluesky/Mastodon)?

## 2026-10-22 – Approved shared presentation

Phase B feed presentation adopts Justin's approved Index / Simplified brand: text-only Studio Journal masthead, paper/ink/stone materials, modest Inter UI and Source Serif reading headings, restrained slate. This supersedes the playful-neon/dark-default presentation direction in section 6 only. The invite-only North Star, A–D milestones, circle privacy, media, composing, pagination and integrations remain unchanged. This styling PR does not assert invite features exist where still planned.
