# Pages Reference

Every user-facing / admin page (`app/**/page.js`). Source of truth is the code.

---

## Funnel

| Route | Type | Purpose |
|-------|------|---------|
| `/` | Static | Landing — hero, features, how-it-works, pricing, FAQ, social proof. |
| `/get-report` | Client | Birth-details form (custom time picker, client sanitization, double-click guard). |
| `/report/preview` | Client | Paywall — 1 free section + curiosity cards + Razorpay integration. |
| `/report/full` | Client | Full report display + PDF download / print / share. |
| `/report/view/[token]` | Client | Shareable/private report view by token (`noindex, nofollow`). |
| `/founder-upgrade` | Client | Post-purchase upsell page (founder membership; retired for new users). |

## Account / user

| Route | Type | Purpose |
|-------|------|---------|
| `/login` | Static | Google OAuth login. |
| `/dashboard` | Dynamic | Logged-in user's saved reports. |
| `/dashboard/report/[reportId]` | Dynamic | Single saved report from DB. |
| `/my-plans` | Client | Membership/plan status for the logged-in user. |
| `/plans` | Static/Client | Plans & pricing overview. |
| `/founder/new` | Client | Grandfathered founder report generation entry point. |

## Content & legal

| Route | Type | Purpose |
|-------|------|---------|
| `/blog` | Dynamic | Blog index (static + DB articles merged). |
| `/blog/[slug]` | Dynamic | Individual article (Article + Breadcrumb schema). |
| `/contact` | Static | Contact page. |
| `/privacy` | Static | Privacy policy. |
| `/terms` | Static | Terms of service. |
| `/refund` | Static | Refund policy. |
| `/unsubscribe` | Client | Email unsubscribe / resubscribe (calls `/api/unsubscribe`). |

## Admin

| Route | Type | Purpose |
|-------|------|---------|
| `/admin` | Client | Super admin dashboard (password-gated). Tabs: Overview, Leads, Paid People, Everyone, Payments, Emails, 12-Mo Guidance, Blog, Economics, Journey, Actions. |

## Non-page routes of note

| Route | Purpose |
|-------|---------|
| `/robots.txt` | Search-engine directives (blocks `/api/`, `/admin`, `/report/full`). |
| `/sitemap.xml` | Dynamic sitemap incl. blog posts. |
| `/llms.txt` | AI-engine discovery file. |
| `/auth/callback` | Google OAuth redirect handler. |

*Last updated: September 2026*
