# SEO CTR Action Plan — round 1 (2026-09-15)

Based on Google Search Console 3-month **Pages** + **Queries** export.

## The core finding

Impressions are climbing (healthy), but **clicks are leaking at the title/meta
level on the pages that already rank**. The biggest opportunities are all
**DB articles** (`blog_posts` table), which is why this plan is mostly
paste-ready rewrites you apply via the new `/api/admin/update-article` endpoint,
plus code fixes already shipped in this PR.

## What this PR already fixed (code)

1. **"Read next" now links by topical relevance**, not a blind first-3 slice.
   Related articles that share keywords/title words are linked, passing ranking
   equity to the right pages and keeping readers on-site. (`app/blog/[slug]/page.js`)
2. **New endpoint `POST /api/admin/update-article`** so DB article titles/metas
   can actually be edited (previously impossible — only new generation existed).

## Priority 1 — the 689-impression page bleeding clicks

`/blog/lagna-chart-vs-moon-chart-which-one-should-you-follow`
**689 impressions → 4 clicks (0.6% CTR).** Ranks, but the title/meta doesn't earn
the click. This single fix is worth more than everything else combined.

Apply:
```bash
curl -X POST https://www.bhavishai.in/api/admin/update-article \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "lagna-chart-vs-moon-chart-which-one-should-you-follow",
    "title": "Lagna Chart vs Moon Chart: Which Should You Trust?",
    "description": "Lagna chart or Moon chart — which reveals the real you? A clear, side-by-side Vedic guide to what each shows and which to follow for love, career and life."
  }'
```
Why: adds curiosity ("Which Should You Trust?"), keeps the exact-match keyword
first, and the description names the outcomes people search for (love, career).

## Priority 2 — Sade Sati: 151 impressions, ZERO clicks

`/blog/what-is-sade-sati-meaning-impact-and-how-to-navigate-it`
High fear-driven search intent, capturing nothing.

```bash
curl -X POST https://www.bhavishai.in/api/admin/update-article \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "what-is-sade-sati-meaning-impact-and-how-to-navigate-it",
    "title": "Sade Sati: Meaning, Effects & How to Survive It",
    "description": "Is Sade Sati really bad? Understand the 7.5-year Saturn phase — its 3 stages, real effects on your life, and practical remedies to get through it calmly."
  }'
```
Why: "How to Survive It" matches the anxiety behind the search; the description
answers the top question ("is it really bad?") and promises remedies.

## Priority 3 — pages with impressions but 0 clicks

Same treatment. Suggested rewrites:

| Slug | New title |
|------|-----------|
| `rashi-vs-lagna-difference` | Rashi vs Lagna: Why They're Not the Same Sign |
| `can-astrology-predict-your-future-a-vedic-perspective` | Can Astrology Really Predict Your Future? |
| `is-foresight-astrology-future-predictions-possible-an-insight` | Can Astrology Predict the Future? An Honest Look |
| `what-is-janam-kundli` (DB copy, 39 impr) | Janam Kundli: What Your Birth Chart Reveals |
| `mesh-rashi-2026-predictions-career-love-and-financial-outlook` | Mesh Rashi 2026: Career, Love & Money Predictions |

(Use `update-article` for DB slugs. `rashi-vs-lagna-difference` and
`what-is-janam-kundli` also exist as STATIC articles in `lib/blog-posts.js`.)

## Priority 4 — duplicate articles cannibalising each other

Google is splitting ranking power across near-identical URLs. Pick ONE winner per
topic and set the loser to `published: false`, or make the loser link to the
winner. Confirmed pairs from the data:

| Topic | Winner (more impressions) | Loser to retire/redirect |
|-------|---------------------------|--------------------------|
| Saturn / Shani | `saturn-shani-in-astrology-...` (34) | `saturn-shani-in-vedic-astrology-...` (11) |
| Kundli matching | `kundli-matching-for-marriage-36-guna-milan-explained` (12) | `kundli-matching-for-marriage` (static, 3) |
| Rashi vs Lagna / Moon | `lagna-chart-vs-moon-chart-...` (689) | `rashi-vs-lagna-difference` (90) → link up to the winner |

Retire a DB loser:
```bash
curl -X POST https://www.bhavishai.in/api/admin/update-article \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"slug": "saturn-shani-in-vedic-astrology-lessons-timing-and-growth", "published": false}'
```

## Priority 5 — new articles worth adding (real search demand, from Queries)

These queries showed impressions with NO dedicated strong article:

1. **"what is moon chart"** (50 impr) — you have `what-is-chandra-kundli` but the
   English searcher types "moon chart". Add "moon chart" prominently to that
   article's title/description/keywords so it matches both.
2. **Love-life cluster is your proven winner** (mithun-rashi-love-life 7% CTR,
   can-astrology-predict-your-love-life 224 impr). Double down: one love/relationship
   prediction article per rashi (Mesh, Vrishabh, Mithun done — add the other 9).

## How to measure

Re-pull the Pages tab in ~2-3 weeks. Success = CTR rising on P1/P2 pages
(especially lagna-vs-moon moving off 0.6%). Titles/metas re-index within days;
ranking shifts take longer.
