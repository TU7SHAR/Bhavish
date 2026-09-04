# SEO Audit — BhavishAI

**Date:** September 2026
**Scope:** Read-only audit of on-page metadata, structured data, sitemap/robots,
social/OG, and Search Console readiness. No code changed in this document.
**Verdict:** Technical SEO foundation is solid (~7/10). The gaps are (a) a few
concrete metadata/social fixes, (b) missing high-intent landing pages + free
tools, and (c) one trust/E-E-A-T overclaim. This audit lists findings; fixes ship
as separate PRs.

Severity legend: 🔴 fix now · 🟠 next · 🟢 later/nice-to-have.

---

## 1. Metadata coverage

**Global (`app/layout.js`)** — strong. Sets `metadataBase`, title template,
description, keywords, robots (index/follow + googleBot directives), canonical,
OpenGraph, Twitter card, and Google verification via
`NEXT_PUBLIC_GOOGLE_VERIFICATION`.

**Per-page `metadata` exports (good):** `/` (homepage), `/blog`, `/blog/[slug]`,
`/contact`, `/dashboard`, `/my-plans`, `/plans`, `/privacy`, `/refund`, `/terms`.

**Pages WITHOUT their own metadata (client components — inherit global title):**
`/get-report`, `/report/preview`, `/report/full`, `/founder-upgrade`,
`/founder/new`, `/unsubscribe`, `/admin`.

| # | Finding | Sev | Recommendation |
|---|---------|-----|----------------|
| 1.1 | `/get-report` is a **client component** so it can't export `metadata` and falls back to the global title. This is a key funnel/landing page. | 🟠 | Split a small server wrapper that exports `metadata` (title like "Get Your Free Kundli Preview"), or render the form as a child of a server page. |
| 1.2 | `/report/full` correctly `disallow`ed in robots but has no `noindex` meta as defense-in-depth. | 🟢 | Add `robots: { index:false }` metadata to be safe if robots.txt is ever bypassed. |
| 1.3 | `/admin`, `/founder-upgrade`, `/unsubscribe` inherit the generic homepage title in the tab/social preview. | 🟢 | Minor; `/admin` is already robots-blocked. Low priority. |

---

## 2. Social / OpenGraph image  🔴

| # | Finding | Sev | Recommendation |
|---|---------|-----|----------------|
| 2.1 | **`public/og-image.png` exists (~1.8 MB) but is NOT referenced** in `layout.js` `openGraph.images` or `twitter.images`. Every share on WhatsApp/X/FB/LinkedIn currently shows **no preview image**. | 🔴 | Add `images: ["/og-image.png"]` to both `openGraph` and `twitter` in `layout.js`. Highest-ROI social fix. |
| 2.2 | The OG image is **~1.8 MB** — too heavy; some scrapers cap at ~1 MB and it slows unfurls. Recommended: 1200×630, < 300 KB. | 🟠 | Re-export/compress the OG image. |
| 2.3 | `productSchema.image` and `articleSchema` fallback point to `/og-image.png` and `/favicon.svg` respectively — fine, but ensure the OG image is the real branded card. | 🟢 | Verify visual quality. |

---

## 3. Structured data (schema.org)

**Present and good:** Organization + WebSite (global, in `layout.js`), and on the
homepage: FAQPage, Product (+ AggregateRating 4.8/2147), Service. Blog posts emit
Article + Breadcrumb. Helpers live in `lib/schema.js`.

| # | Finding | Sev | Recommendation |
|---|---------|-----|----------------|
| 3.1 | The homepage (`app/page.js`) defines its **own** inline `faqSchema`, `productSchema`, `serviceSchema` that **duplicate** `lib/schema.js`. Two sources of truth can drift (e.g. prices). | 🟠 | Import from `lib/schema.js` (already exports `productSchema`, `serviceSchema`) and keep only FAQ inline, or move FAQ into `lib/schema.js` too. |
| 3.2 | `AggregateRating` (4.8, 2147 reviews) is **static/hardcoded**. Google increasingly scrutinizes self-serving review markup; if it's not backed by real, on-page reviews it risks a manual action or being ignored. | 🟠 | Either surface real reviews on-page to justify it, or reduce the claimed `reviewCount` to something defensible. Documented also as PROJECT.md pain point ("social proof static"). |
| 3.3 | No `FAQPage`/`HowTo`/`Breadcrumb` schema on the (future) tool and cluster pages. | 🟠 | Bake schema into the tool template (task A) and cluster pages (task C) from day one. |
| 3.4 | Product `hasMerchantReturnPolicy` = `MerchantReturnNotPermitted` while a `/refund` policy page exists. Possible mismatch. | 🟢 | Align schema with the actual refund policy. |

---

## 4. Sitemap & robots

**`app/sitemap.js`** — dynamic; includes homepage, `/get-report`, `/blog`, legal
pages, and all blog posts (static + DB). **`app/robots.js`** — allows `/`,
disallows `/api/`, `/report/full`, `/admin`; points to sitemap. `/llms.txt` served
via `app/llms.txt/route.js`.

| # | Finding | Sev | Recommendation |
|---|---------|-----|----------------|
| 4.1 | Sitemap does **not** yet include `/tools/*` or cluster pages (they don't exist yet). | 🟠 | Add them to `sitemap.js` as tasks A & C land. |
| 4.2 | Sitemap omits `/plans` and `/contact` (they exist and have metadata). | 🟢 | Add to `staticRoutes`. |
| 4.3 | `changeFrequency`/`priority` are reasonable. Homepage priority 1.0, blog 0.7. | ✅ | No change. |

---

## 5. Search Console readiness

| # | Finding | Sev | Recommendation |
|---|---------|-----|----------------|
| 5.1 | Verification wired via `NEXT_PUBLIC_GOOGLE_VERIFICATION` env — **confirm it's set in Vercel production** and the property is verified. | 🔴 (owner action) | Verify domain property in GSC; submit `https://www.bhavishai.in/sitemap.xml`. |
| 5.2 | GA4 gated behind `NEXT_PUBLIC_GA_ID` — confirm set in prod (it's referenced but not in `.env.example`). | 🟠 (owner action) | Set `NEXT_PUBLIC_GA_ID` in Vercel; confirm real-time hits. |
| 5.3 | No process yet to mine GSC "impressions with low CTR / low position" into new content. | 🟢 | Once GSC has ~4 weeks of data, build content from actual query impressions. |

---

## 6. Trust / E-E-A-T  🔴

| # | Finding | Sev | Recommendation |
|---|---------|-----|----------------|
| 6.1 | Homepage (`app/page.js:262`) claims: *"Swiss Ephemeris Calculations — Same astronomical engine used by NASA. Sub-arcminute planetary precision."* The repo actually uses **`astronomy-engine`** (Swiss-Ephemeris-*equivalent*); **"used by NASA" is not accurate**. | 🔴 | Rewrite to a defensible claim, e.g. *"High-precision astronomical calculations — planetary positions computed with a high-precision astronomical engine, Lahiri ayanamsa, and classical Vedic rules."* (This is **task B**.) |
| 6.2 | "Swiss Ephemeris" also appears in emails/PDF/preview UI copy. | 🟢 | Optional: soften to "high-precision ephemeris" consistently for a uniform, defensible voice. |
| 6.3 | No visible author/expertise or "how we calculate" transparency page. | 🟠 | A `/methodology` or About page describing the engine + ayanamsa + rules boosts E-E-A-T and gives something to cite. |

---

## 7. The strategic gap (why "SEO-ready ≠ SEO-competitive")

The plumbing is done; the **moat** is missing. Priority build order:

1. **Free tools** using the existing deterministic engine (biggest moat):
   `/tools/manglik-calculator` (template — **task A**), then Nakshatra, Rashi,
   Lagna, Dasha calculators. Each: educational copy → live calculator → CTA into
   the ₹299 report.
2. **High-intent landing pages / topic clusters** (**task C**): Kundli
   (`/kundli/janam-kundli`, `…/kundli-by-date-of-birth`, `…-and-time`,
   `/free-kundli`), Marriage (`/marriage/kundli-matching`, `…/manglik-dosha`),
   Dasha, Dosha, Career — each internally linking into the tools + `/get-report`.
3. **Internal linking**: homepage + blog → tools → landing pages → `/get-report`.

Funnel target: `Google query → tool/landing page → free calc → "Generate my report" → lead → ₹299/₹499`.

---

## 8. Prioritized action list

**🔴 Now**
- Add OG/Twitter `images` to `layout.js` (2.1) + compress OG image (2.2).
- Fix the "used by NASA" claim (6.1 → task B).
- Confirm GSC verified + sitemap submitted; confirm `NEXT_PUBLIC_GA_ID` set (5.1, 5.2 — owner).

**🟠 Next**
- Build the Manglik tool as the reusable template (task A), then clone ×4.
- Build high-intent cluster/landing pages (task C).
- De-duplicate homepage schema vs `lib/schema.js` (3.1); make ratings defensible (3.2).
- Give `/get-report` its own metadata (1.1). Add tools + `/plans` + `/contact` to sitemap (4.1, 4.2).

**🟢 Later**
- `/methodology` E-E-A-T page (6.3).
- GSC-driven content (5.3). Hindi/Punjabi/Hinglish intent. Programmatic pages. Backlinks/digital PR.

---

*Audit only — no runtime code changed. Fixes tracked as their own PRs.*
