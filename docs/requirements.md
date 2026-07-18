# Technical Requirements & Constraints

## BhavishAI — Non-Functional Specifications

**Version:** 1.0
**Last Updated:** July 2026

---

## 1. Performance Requirements

| Metric | Target | Rationale |
|--------|--------|-----------|
| Landing page LCP | < 2.0s | Above-fold content must load fast (ad traffic bounces >3s) |
| Form page TTI | < 3.0s | Interactive form within 3s of navigation |
| Preview generation (end-to-end) | < 45s | Geocode + chart calc + Gemini AI. User sees loading messages |
| Full report generation | < 60s | Post-payment; Vercel maxDuration=60 |
| Payment verification | < 2s | Razorpay signature check is CPU-only |
| PDF download (server) | < 10s | jsPDF rendering is fast; network is bottleneck |
| Email delivery | < 30s | Resend API call + Gmail fallback |
| Admin dashboard load | < 5s | Acceptable for internal tool |
| Blog page load | < 2.5s | Server-rendered, should be fast |

### Acceptable Degradation
- Preview generation may take up to 60s under Gemini load (retry with backoff)
- Email delivery is best-effort (non-blocking, logged failures)
- PDF generation failure → email sent without attachment (still has HTML report)

---

## 2. Reliability Targets

| Component | Target Uptime | Failure Mode |
|-----------|--------------|--------------|
| Landing + form | 99.9% | Vercel static → near-zero downtime |
| Preview generation | 99% | Gemini 503 → retry → user-friendly error |
| Payment processing | 99.9% | Razorpay SLA; webhook + reconciliation = no lost payments |
| Full report delivery | 99.5% | Triple-path (browser + webhook + reconcile) |
| Email nurture | 95% | Cron runs 2x daily; missed emails caught next run |
| Admin panel | 99% | Non-critical; Vercel restarts fix most issues |

### Failure Recovery Strategies

| Failure | Recovery |
|---------|----------|
| Gemini 503 (model overloaded) | Exponential backoff: 2s, 4s, 8s. Max 3 retries |
| Gemini parse error (bad JSON) | Show "Failed to generate. Please try again." |
| Razorpay webhook missed | Reconciliation endpoint scans last N payments |
| UPI payment (browser never returns) | Webhook catches it; fulfillPayment() runs server-side |
| Supabase unreachable (rate limit) | Rate limiter fails open (allows request) |
| Resend email failure | Gmail SMTP fallback |
| Gmail fallback failure | Log error; report still visible on-screen + in DB |
| DB save failure on payment | Payment verification still returns success (non-critical) |

---

## 3. Security Standards

### 3.1 Authentication & Authorization

| Requirement | Implementation |
|------------|----------------|
| Admin endpoints must verify secret | `verifyAdmin()` with timing-safe comparison |
| Cron endpoints must verify secret | `verifyCron()` with timing-safe comparison |
| Internal API calls must be authenticated | `verifyInternal()` + `getInternalAuthHeaders()` |
| User dashboard requires login | Supabase Auth (Google OAuth) session check |
| Payment amount cannot be client-controlled | Server computes price in `create-order` |
| Payment signature must be cryptographically verified | HMAC SHA-256 (`crypto.createHmac`) |
| Webhook signature must use raw body | `request.text()` before JSON parse |

### 3.2 Input Security

| Requirement | Implementation |
|------------|----------------|
| All user inputs must be sanitized for AI prompts | `sanitizeForPrompt()` — 16 injection patterns |
| HTML tags stripped from all inputs | `sanitizeName()`, `sanitizePlace()` |
| XSS prevention in email output | `sanitizeForHtml()` — entity encoding |
| Form inputs validated with schema | Zod validation on `generate-preview` |
| Date of birth cannot be future or pre-1920 | Client + server validation |
| Personal question truncated to 300 chars | `sanitizeForPrompt(input, 300)` |

### 3.3 Rate Limiting

| Route Type | Limit | Implementation |
|-----------|-------|----------------|
| AI generation (expensive) | 3 req/min/IP | Supabase-backed + in-memory burst guard |
| Payment routes | 5 req/min/IP | Supabase-backed |
| Save/data routes | 10 req/min/IP | Supabase-backed |
| Tracking pixel | 30 req/min/IP | Supabase-backed |
| Email generation | 2 req/min/IP | Supabase-backed |

### 3.4 Secrets Management

| Secret | Storage | Rotation Policy |
|--------|---------|-----------------|
| GEMINI_API_KEY | Vercel env vars | Rotate if compromised |
| RAZORPAY_KEY_SECRET | Vercel env vars | Rotate if compromised |
| RAZORPAY_WEBHOOK_SECRET | Vercel env vars + Razorpay dashboard | Must match both sides |
| SUPABASE_SERVICE_ROLE_KEY | Vercel env vars | Never expose to client |
| CRON_SECRET / ADMIN_SECRET | Vercel env vars | Change periodically |
| RESEND_API_KEY | Vercel env vars | Rotate if compromised |
| GMAIL_APP_PASSWORD | Vercel env vars | Rotate annually |

---

## 4. Scalability Expectations

### Current Scale (Phase 1)
- 10-50 reports/day
- 100-500 daily visitors
- 1 admin user
- ~200 total leads in DB

### Phase 2 Target (6 months)
- 200-500 reports/day
- 2,000-5,000 daily visitors
- Gemini paid tier required
- Resend paid tier required
- Supabase pro plan (connection pooling)

### Phase 3 Target (12 months)
- 1,000+ reports/day
- Queue system for report generation
- CDN for PDF storage (not regenerated each time)
- Redis for rate limiting (replace Supabase)
- Multiple Gemini model fallbacks

---

## 5. Browser & Device Compatibility

### Supported Browsers
| Browser | Version | Priority |
|---------|---------|----------|
| Chrome (Android) | 90+ | Primary (60%+ of traffic) |
| Safari (iOS) | 14+ | Primary (25% of traffic) |
| Chrome (Desktop) | 90+ | Secondary |
| Firefox | 90+ | Low priority |
| Edge | 90+ | Low priority |

### Device Requirements
- **Mobile-first design** — 70%+ traffic from smartphones
- **Responsive breakpoints:** 640px, 768px, 1024px, 1280px
- **Touch-friendly:** All buttons ≥44px tap target
- **Dark theme only** — cosmic/astrology aesthetic

### JavaScript Requirements
- ES2020+ (async/await, optional chaining)
- Dynamic imports (jsPDF loaded on demand)
- sessionStorage + localStorage available
- `fetch` API available

---

## 6. Data Retention & Privacy

| Data Type | Retention | Deletion |
|-----------|-----------|----------|
| Lead data (unpaid) | Indefinite | On request (manual) |
| Paid reports | Indefinite | On request (manual) |
| Email drafts | Until sequence complete or unsubscribed | Auto (overwrite with null) |
| Attribution data | Indefinite | Part of lead row |
| Rate limit counters | 2 hours max | Auto-cleanup function |
| Blog posts | Indefinite | Admin can unpublish |
| Auth sessions | Supabase managed | Auto-expire |

### Privacy Compliance
- Privacy policy page exists (`/privacy`)
- No data sold to third parties
- Email unsubscribe mechanism functional
- No cookies beyond Supabase auth (analytics use localStorage)
- Birth data is not shared externally (only sent to Gemini for generation)

---

## 7. Infrastructure Constraints

### Hard Limits (Cannot Exceed)

| Constraint | Limit | Source |
|-----------|-------|--------|
| Vercel function timeout | 60s (Pro) / 10s (Hobby) | Vercel plan |
| Vercel function payload | 4.5 MB | Vercel limit |
| Gemini RPM | 15 requests/minute | Google AI Studio free tier |
| Gemini RPD | 500 requests/day | Google AI Studio free tier |
| Resend emails/day (free) | 100 | Resend free tier |
| Resend rate | 2 requests/second | Resend API limit |
| Nominatim rate | 1 request/second | Fair use policy |
| Supabase rows (free) | 500MB total | Supabase free tier |
| Supabase auth users (free) | 50,000 MAU | Supabase free tier |

### Soft Limits (Can Be Upgraded)

| Constraint | Current | Upgraded |
|-----------|---------|----------|
| Gemini model | 3.1-flash-lite (cheapest) | 2.5-pro (better quality) |
| Resend plan | Free (100/day) | Growth ($20/mo, 50k/mo) |
| Vercel plan | Hobby (10s timeout) | Pro (60s, team features) |
| Supabase plan | Free | Pro ($25/mo, backups, pooling) |

---

## 8. Code Quality Standards

### Style Guidelines
- **No TypeScript** — plain JavaScript with JSDoc comments where needed
- **ESLint** with next config (standard Next.js rules)
- **Tailwind 4** — utility-first CSS, no custom CSS files except globals
- **File naming:** kebab-case for routes, camelCase for lib functions
- **Comments:** Explain WHY, not WHAT. Inline comments for non-obvious decisions

### Architecture Rules
1. **Deterministic astrology rules MUST be computed in code** — never delegated to AI
2. **AI output MUST be validated** — quality gate on section count + required sections
3. **Payment state MUST be verified server-side** — never trust client storage
4. **Rate limiters MUST be applied to all public AI-calling routes**
5. **Secrets MUST use timing-safe comparison** — never `===` for auth checks
6. **DB operations MUST handle column-not-exists gracefully** — fallback without new columns
7. **Email delivery MUST have a fallback** — Resend primary, Gmail secondary
8. **All prices MUST be computed server-side** — frontend displays but doesn't decide

### Error Handling Pattern
```javascript
try {
  // Main operation
} catch (error) {
  console.error("[context] Description:", error.message);
  // Non-critical? Log and continue
  // Critical? Return user-friendly error message
  return NextResponse.json(
    { error: "User-friendly message. Please try again." },
    { status: 500 }
  );
}
```

---

## 9. Dependency Constraints

### Production Dependencies (package.json)

| Package | Version | Purpose | Can Be Replaced? |
|---------|---------|---------|-------------------|
| next | 16.x | Framework | No |
| react / react-dom | 19.x | UI library | No |
| @google/generative-ai | ^0.24 | Gemini SDK | Could switch to REST API |
| @supabase/ssr | ^0.12 | Server-side Supabase | No (core to auth) |
| @supabase/supabase-js | ^2.108 | DB client | No (core to data) |
| astronomy-engine | ^2.1 | Planetary calculations | No (core domain) |
| razorpay | ^2.9 | Payment SDK | No (India-only payments) |
| resend | ^6.14 | Email API | Could use Postmark/SendGrid |
| nodemailer | ^9.0 | SMTP fallback | Could remove if Resend is reliable |
| jspdf | ^4.2 | PDF generation | Could use Puppeteer (heavier) |
| zod | ^4.4 | Input validation | Could use yup/joi |

### Key Constraints
- **No Redis dependency** — rate limiting uses Supabase to avoid adding infrastructure
- **No queue system** — report generation is synchronous within Vercel timeout
- **No file storage** — PDFs generated on-demand, not stored
- **No CDN for assets** — Vercel's built-in CDN handles static files
- **No Docker** — Vercel serverless, no container config

---

*These requirements should be reviewed quarterly as traffic grows and business needs evolve.*
