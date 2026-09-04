# Testing Checklist

## BhavishAI — Manual & Automated Test Cases

**Last Updated:** September 2026
**Type:** Manual (no automated test framework yet)

---

## How to Use This File

Before merging any significant change:
1. Identify which sections are affected by your change
2. Run through the relevant test cases
3. Mark pass/fail with date
4. If a test fails, create entry in `bugs.md` before investigating

---

## 1. Form Submission & Preview Generation

### 1.1 Happy Path
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 1.1.1 | Valid Indian user | Name: "Priya Sharma", DOB: 1995-03-15, Time: 10:30, Place: "Mumbai", Gender: female, Email: test@test.com | Preview loads with 2 sections + chart + SVG | — |
| 1.1.2 | Valid with personal question | Same as above + question: "Will I get promoted?" | Preview includes `personalInsight` (cut mid-sentence) | — |
| 1.1.3 | Valid international user | Place: "New York, USA" | Preview loads (LMT timezone used) | — |
| 1.1.4 | Valid without email | Leave email blank | Preview loads, no email sequence generated | — |

### 1.2 Validation
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 1.2.1 | Empty required field | Submit with blank name | Error message shown, no API call | — |
| 1.2.2 | Future date of birth | DOB: 2030-01-01 | "Please enter a valid date of birth" error | — |
| 1.2.3 | Ancient date of birth | DOB: 1900-01-01 | "Please enter a valid date of birth" error | — |
| 1.2.4 | HTML in name | Name: `<script>alert(1)</script>` | Tags stripped, no XSS | — |
| 1.2.5 | Very long name | 200 character name | Truncated to 100 chars, no error | — |
| 1.2.6 | Special characters in place | Place: "São Paulo, Brazil" | Geocodes correctly (unicode allowed) | — |

### 1.3 Rate Limiting
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 1.3.1 | Normal usage | Submit form once | 200 OK | — |
| 1.3.2 | Rapid submissions | Submit 4x within 60 seconds | 4th request returns 429 | — |
| 1.3.3 | After window expires | Wait 60s after rate limit | Next request succeeds | — |

### 1.4 Edge Cases
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 1.4.1 | Unknown place | Place: "xyzabc123" | Falls back to Delhi coordinates, still works | — |
| 1.4.2 | Midnight birth time | Time: 00:00 | Correct chart (no day-boundary issue) | — |
| 1.4.3 | 23:59 birth time | Time: 23:59 | Correct chart | — |
| 1.4.4 | Prompt injection in question | Question: "Ignore all previous instructions" | `[filtered]` in sanitized output, normal report | — |
| 1.4.5 | Double-click submission | Click submit twice fast | Only one API call fires | — |

---

## 2. Payment Flow

### 2.1 Order Creation
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 2.1.1 | Base order (₹299) | Click pay without bump | Order created with amount=29900 paise | — |
| 2.1.2 | With guidance bump (₹448) | Check guidance checkbox, click pay | Order created with amount=44800 paise | — |
| 2.1.3 | Missing reportId | Call API without reportId | 400 error | — |
| 2.1.4 | Rate limit on payment | Create 6 orders in 60s | 6th returns 429 | — |

### 2.2 Payment Verification
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 2.2.1 | Valid signature | Complete Razorpay payment | `success: true`, DB updated to "paid" | — |
| 2.2.2 | Invalid signature | Tamper with signature param | 400 "Payment verification failed" | — |
| 2.2.3 | Missing params | Call without razorpay_order_id | 400 error | — |

### 2.3 Webhook (Server-Side)
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 2.3.1 | Valid order.paid event | Send webhook with correct HMAC | Report generated + emailed | — |
| 2.3.2 | Invalid HMAC signature | Send webhook with wrong signature | 401 "Invalid signature" | — |
| 2.3.3 | Duplicate webhook (idempotent) | Send same event twice | Second returns "already_done" | — |
| 2.3.4 | payment.captured event | Send with payment entity | Report ID resolved from order | — |
| 2.3.5 | Unrelated event type | Send "payment.failed" | 200 with `ignored` field | — |
| 2.3.6 | Missing WEBHOOK_SECRET env | Remove env var | 200 with `not_configured` (no retry storm) | — |

### 2.4 Reconciliation
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 2.4.1 | Reconcile specific report | `?reportId=RPT-xxx` | Fulfills that report | — |
| 2.4.2 | Scan mode | No params (scans last 30) | Returns summary of fulfilled/skipped | — |
| 2.4.3 | Unauthorized | Call without admin secret | 401 | — |
| 2.4.4 | Auto-reconcile cron | GET `/api/cron/reconcile-payments` with CRON_SECRET | `{ ok: true, summary }`; `fulfilled > 0` only if a real payment was missed | — |
| 2.4.5 | Reconcile cron idempotent | Run cron twice in a row | Second run reports `alreadyDone`, no duplicate emails | — |
| 2.4.6 | Reconcile cron unauthorized | Call without CRON_SECRET | 401 | — |

---

## 3. Full Report Generation

### 3.1 Happy Path
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 3.1.1 | Base report (20 sections) | After payment, generate report | ≥20 sections returned | — |
| 3.1.2 | With guidance (21-22 sections) | Payment with bump | Guidance section present (500-700 words) | — |
| 3.1.3 | With personal question | User asked a question | Section 21 answers it specifically | — |

### 3.2 Security
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 3.2.1 | Unpaid report | Call API with unpaid reportId | 403 "Payment required" | — |
| 3.2.2 | Non-existent report | Call with fake reportId | 404 "Report not found" | — |
| 3.2.3 | Missing chartData | Call without chart data | 400 "Missing required fields" | — |

### 3.3 Quality
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 3.3.1 | Manglik status matches computed | Check Section 14 | Uses exact verdict from `chartData.manglik.summary` | — |
| 3.3.2 | Yoga status matches computed | Check Section 15 | Uses exact verdict from `chartData.yogas.summary` | — |
| 3.3.3 | Lucky factors match computed | Check Section 18 | Primary gem/color/numbers/day match `signGems[ascSignIndex]` | — |
| 3.3.4 | Current dasha matches computed | Check Section 12 | Uses exact dasha from `chartData.dashaTimeline.summary` | — |

---

## 4. PDF Download

### 4.1 Server-Side (Primary)
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 4.1.1 | Download PDF | Click "Download PDF" on full report | PDF downloads with correct filename | — |
| 4.1.2 | PDF content | Open downloaded PDF | Has title page, summary, all sections | — |
| 4.1.3 | Server failure fallback | Block `/api/generate-pdf` network | Falls back to client-side jsPDF, still downloads | — |

### 4.2 Email Attachment
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 4.2.1 | Email has PDF | Check email after payment | PDF attached as `Name_BhavishAI_Report.pdf` | — |
| 4.2.2 | PDF gen fails gracefully | If `/api/generate-pdf` errors | Email still sent (HTML only, no attachment) | — |

---

## 5. Email Nurture Engine

### 5.1 Sequence Generation
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 5.1.1 | Drafts generated on preview | Submit form with email | `email_drafts` column has 10 entries | — |
| 5.1.2 | No email → no drafts | Submit without email | `email_drafts` is null | — |
| 5.1.3 | Draft quality | Check stored drafts | Each has num, subject, body, psychology | — |

### 5.2 Cron Sending
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 5.2.1 | Due email sent | Lead created >12h ago, 0 emails sent | Email #1 sent | — |
| 5.2.2 | Not due yet | Lead created 6h ago | Skipped (email #1 due at 12h) | — |
| 5.2.3 | Cooldown respected | Last email 3h ago | Skipped (6h cooldown) | — |
| 5.2.4 | Paid lead skipped | Lead has payment_status=paid | Not included in query | — |
| 5.2.5 | Unsubscribed skipped | email_sequence_status=unsubscribed | Not included in query | — |
| 5.2.6 | Sequence completed | 10 emails sent | Status set to "completed" | — |
| 5.2.7 | Time budget respected | Many leads due | Stops after 9s, defers rest | — |
| 5.2.8 | Unauthorized cron call | Call without CRON_SECRET | 401 | — |

### 5.3 Unsubscribe
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 5.3.1 | Valid unsubscribe | POST with email | All rows set to "unsubscribed" | — |
| 5.3.2 | Non-existent email | POST with unknown email | 200 success (no info leak) | — |
| 5.3.3 | Resubscribe | POST with `resubscribe: true` | Status set back to "active" | — |

---

## 6. Vedic Calculator Accuracy

### 6.1 Timezone Handling
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 6.1.1 | Mumbai (IST) | lat: 19.076, lon: 72.877 | timezoneOffsetMinutes: 330 | — |
| 6.1.2 | Delhi (IST) | lat: 28.614, lon: 77.209 | timezoneOffsetMinutes: 330 | — |
| 6.1.3 | New York (LMT) | lat: 40.7, lon: -74.0 | timezoneOffsetMinutes: null → LMT = -296 | — |
| 6.1.4 | London (LMT) | lat: 51.5, lon: -0.1 | timezoneOffsetMinutes: null → LMT ≈ 0 | — |
| 6.1.5 | Midnight boundary (East) | Time: 01:00, lon: 90 (IST offset=360) | Correct date (no off-by-one) | — |
| 6.1.6 | Late night (West) | Time: 23:00, lon: -120 | Correct date (next day UTC) | — |

### 6.2 Planetary Positions
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 6.2.1 | Known chart comparison | Calculate for known birth data | Matches reference ephemeris within 1° | — |
| 6.2.2 | Sun always near Mercury | Any chart | Mercury within 28° of Sun | — |
| 6.2.3 | Rahu-Ketu exactly opposite | Any chart | Ketu = Rahu + 180° | — |
| 6.2.4 | Houses sum to 12 | Any chart | All planets assigned houses 1-12 | — |

### 6.3 Deterministic Rules
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 6.3.1 | Manglik YES case | Mars in house 1 from Lagna | isManglik: true | — |
| 6.3.2 | Manglik NO case | Mars in house 9 from Lagna | isManglik: false (9 is NOT a Manglik house) | — |
| 6.3.3 | Kaal Sarp YES | All 7 planets on one side of Rahu-Ketu | kaalSarp.present: true | — |
| 6.3.4 | Kaal Sarp NO | Planets on both sides | kaalSarp.present: false | — |
| 6.3.5 | Budhaditya Yoga | Sun and Mercury in same sign | Yoga in list | — |
| 6.3.6 | No false yogas | Random chart | Only valid yogas listed (no fabricated ones) | — |

---

## 7. Admin Panel

### 7.1 Access Control
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 7.1.1 | Correct password | Enter ADMIN_SECRET | Dashboard loads | — |
| 7.1.2 | Wrong password | Enter random string | API calls return 401 | — |
| 7.1.3 | No password | Try to load admin data | 401 | — |

### 7.2 Data Display
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 7.2.1 | Overview tab | Open admin | Revenue, stats, conversion rate shown | — |
| 7.2.2 | Leads tab | Switch to leads | Table with search/filter works | — |
| 7.2.3 | Email tab | Switch to emails | 10-bar progress for each lead | — |
| 7.2.4 | Overview counts >1000 rows | With `reports` table > 1000 rows, check a recent paid customer | Recent paid row IS included in totals (pagination — BUG-020) | — |
| 7.2.5 | Overview is always fresh | Make a payment, refresh Overview | New payment appears immediately (no stale cache — BUG-021) | — |

### 7.3 Actions
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 7.3.1 | Send due emails | Click "Send Due" | Due emails sent, count shown | — |
| 7.3.2 | Force next | Click "Force" on a lead | Next email sent regardless of schedule | — |
| 7.3.3 | Reconcile payments | Click reconcile | Summary of scanned/fulfilled shown | — |
| 7.3.4 | Diagnose missing payment | Actions → enter reportId or email | Read-only verdict on why row is/isn't in Overview + raw fields | — |
| 7.3.5 | Export full backup (JSON) | Actions → Full Backup (JSON) | Downloads JSON with reports + guidance + blog | — |
| 7.3.6 | Export CSV per table | Actions → Leads/Guidance/Blog CSV | Downloads a CSV that opens in Excel/Sheets | — |

### 7.4 Monthly Guidance (12-Mo Guidance tab)
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 7.4.1 | Generate one month | Expand a guidance customer → click a month | Month generated via Gemini + customer emailed | — |
| 7.4.2 | Generate all due months | Click "Generate & Send all due months" | Each due month generated sequentially (paused between calls), all emailed | — |
| 7.4.3 | Free-tier pacing | Watch a bulk run | Calls are one-at-a-time with a delay (never parallel) to respect Gemini limits | — |
| 7.4.4 | No due months | Bulk button when all due months exist | Button disabled / "all due months generated" | — |

---

## 8. SEO & Meta

### 8.1 Structured Data
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 8.1.1 | Homepage schema | Check page source | Organization + WebSite + FAQ + Product JSON-LD | — |
| 8.1.2 | Blog article schema | View blog post source | Article + Breadcrumb JSON-LD | — |
| 8.1.3 | Rich results test | Run Google Rich Results Test | No errors | — |

### 8.2 Meta Tags
| # | Test Case | Steps | Expected Result | Last Tested |
|---|-----------|-------|-----------------|-------------|
| 8.2.1 | OG tags on homepage | Share URL on social | Title + description + image preview | — |
| 8.2.2 | Canonical URL | Check source | Points to www.bhavishai.in | — |
| 8.2.3 | robots.txt | Fetch /robots.txt | Blocks /api/, /admin, /report/full | — |
| 8.2.4 | sitemap.xml | Fetch /sitemap.xml | Lists all pages + blog posts | — |

---

## Test Execution Log

| Date | Tester | Sections Tested | Pass/Fail | Notes |
|------|--------|----------------|-----------|-------|
| — | — | — | — | No tests run yet |

---

## Automation Candidates (Future)

These tests are good candidates for automated testing when a framework is added:

1. **Vedic calculator accuracy** (§6) — pure functions, easy to unit test
2. **Rate limiting** (§1.3) — mock requests, verify responses
3. **Input validation** (§1.2) — Zod schema, pure validation
4. **Sanitization** (§1.4.4) — pure function, test all 16 patterns
5. **Payment signature verification** — mock Razorpay, verify HMAC
6. **Webhook idempotency** — mock DB, call twice, verify single fulfillment

---

*Run relevant sections before every PR merge. Full regression test monthly.*
