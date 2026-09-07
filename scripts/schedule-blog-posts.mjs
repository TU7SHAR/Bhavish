#!/usr/bin/env node
/**
 * BLOG POST SCHEDULER
 * ===================
 *
 * Staggers the publish dates of the SEO article clusters so they go live
 * ONE PER DAY instead of all at once. This works with the /blog + sitemap
 * "future date = hidden" gate (PR #199): any post whose `date` is in the
 * future is hidden until that day arrives, then auto-appears.
 *
 * WHY A SCRIPT (not hand-edited dates): the 68 articles were written across
 * several branches (#200–#204). Once those are merged into a single
 * lib/blog-posts.js, run this ONCE to assign clean, consecutive, 1/day dates
 * in a deliberate cluster order — repeatable and impossible to get out of sync.
 *
 * ─── USAGE ──────────────────────────────────────────────────────────────
 *   1. Merge #199–#204 into your working branch/main first (so all 68 posts
 *      exist in lib/blog-posts.js).
 *   2. Run:
 *        node scripts/schedule-blog-posts.mjs                 # start = tomorrow
 *        node scripts/schedule-blog-posts.mjs --start 2026-10-01
 *        node scripts/schedule-blog-posts.mjs --per-day 2     # 2 posts/day
 *        node scripts/schedule-blog-posts.mjs --dry-run       # preview only
 *   3. Review the diff, commit, open a PR, merge → posts roll out 1/day.
 *
 * SAFETY:
 *   - Only rewrites the `date:` of posts whose slug is in SCHEDULE_ORDER below
 *     (the 68 new cluster articles). The original 9 posts are left untouched
 *     and stay live.
 *   - Idempotent-ish: re-running re-assigns dates from the same start date, so
 *     you can re-run to shift the whole schedule.
 *   - Never touches content, titles, keywords — only the date field.
 * ────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_FILE = join(__dirname, "..", "lib", "blog-posts.js");

// Publish order: Manglik first (the tool + landing page funnel already exist),
// then Kundli, Marriage, Career, Wealth, then the General/education cluster.
// Interleaving keeps each day's new post varied while front-loading intent.
const SCHEDULE_ORDER = [
  // ── Manglik cluster (highest intent — funnels into the live tool) ──
  "how-to-check-if-you-are-manglik",
  "manglik-dosha-in-1st-house",
  "manglik-dosha-in-7th-house",
  "manglik-dosha-in-8th-house",
  "can-manglik-dosha-be-cancelled",
  "can-a-manglik-marry-a-non-manglik",
  "manglik-dosha-remedies",
  "mars-in-different-houses-manglik",
  "manglik-dosha-vs-kuja-dosha",
  "manglik-dosha-and-marriage-what-it-means",
  // ── Kundli cluster ──
  "how-to-read-a-janam-kundli",
  "what-is-lagna-in-kundli",
  "what-is-rashi-moon-sign",
  "what-is-a-birth-chart-vedic-astrology",
  "how-is-kundli-calculated",
  "kundli-without-exact-birth-time",
  "what-can-kundli-by-date-of-birth-reveal",
  "12-houses-in-kundli",
  "9-planets-in-vedic-astrology",
  "what-is-navamsa-d9-chart",
  "d1-vs-d9-chart-difference",
  "what-is-chandra-kundli",
  "understand-planetary-positions-kundli",
  // ── Marriage / Love cluster ──
  "marriage-timing-in-kundli",
  "houses-indicate-marriage-vedic",
  "7th-house-in-kundli",
  "role-of-venus-in-marriage",
  "role-of-jupiter-in-marriage",
  "love-marriage-in-vedic-astrology",
  "love-marriage-vs-arranged-marriage",
  "what-is-guna-milan",
  "ashtakoota-kundli-matching",
  "nadi-dosha-explained",
  "bhakoot-dosha-explained",
  "kundli-matching-what-to-check",
  // ── Career cluster (high commercial intent) ──
  "career-prediction-vedic-astrology",
  "houses-represent-career-kundli",
  "10th-house-vedic-astrology",
  "saturn-in-career-astrology",
  "sun-in-career-authority",
  "career-change-in-kundli",
  "government-job-in-kundli",
  "business-or-job-kundli",
  "career-strengths-birth-chart",
  "dashas-career-timing",
  "what-is-mahadasha",
  "what-is-antardasha",
  "mahadasha-vs-antardasha",
  // ── Wealth cluster ──
  "wealth-in-vedic-astrology",
  "2nd-house-wealth",
  "11th-house-gains",
  "jupiter-and-wealth",
  "venus-and-prosperity",
  "rahu-sudden-gains",
  "financial-potential-vedic-astrology",
  // ── General / education cluster ──
  "what-is-vedic-astrology",
  "vedic-vs-western-astrology",
  "12-rashis-explained",
  "what-are-yogas-in-vedic-astrology",
  "pancha-mahapurusha-yoga",
  "what-is-a-nakshatra",
  "27-nakshatras-explained",
  "what-is-pada-nakshatra",
  "planetary-transits-explained",
  "exalted-and-debilitated-planets",
  "what-is-retrograde-vedic-astrology",
  "12-houses-vedic-astrology-guide",
  "how-accurate-is-vedic-astrology",
];

function parseArgs(argv) {
  const args = { start: null, perDay: 1, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--start") args.start = argv[++i];
    else if (a === "--per-day") args.perDay = Math.max(1, parseInt(argv[++i], 10) || 1);
  }
  return args;
}

function ymd(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function main() {
  const { start, perDay, dryRun } = parseArgs(process.argv);

  // Default start = tomorrow (UTC), so nothing publishes the moment you merge.
  const startDate = start ? new Date(`${start}T00:00:00Z`) : (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  })();

  if (Number.isNaN(startDate.getTime())) {
    console.error(`✖ Invalid --start date: "${start}" (use YYYY-MM-DD)`);
    process.exit(1);
  }

  let src = readFileSync(BLOG_FILE, "utf8");
  const changes = [];
  const missing = [];

  SCHEDULE_ORDER.forEach((slug, index) => {
    // Each post's date = startDate + floor(index / perDay) days.
    const dayOffset = Math.floor(index / perDay);
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + dayOffset);
    const newDate = ymd(d);

    // Find this post's object by its slug, then rewrite the FIRST `date:` that
    // follows within the same object. We match the slug line, then the next
    // date line. Regex is scoped to avoid touching other posts.
    const slugRe = new RegExp(
      `(slug:\\s*"${slug.replace(/[-/\\^$*+?.()|[\\]{}]/g, "\\$&")}"[\\s\\S]*?date:\\s*")([^"]*)(")`
    );
    const m = src.match(slugRe);
    if (!m) {
      missing.push(slug);
      return;
    }
    if (m[2] !== newDate) changes.push({ slug, from: m[2], to: newDate });
    src = src.replace(slugRe, `$1${newDate}$3`);
  });

  // Report
  console.log(`\nBlog scheduler — start ${ymd(startDate)}, ${perDay} post(s)/day\n`);
  if (missing.length) {
    console.warn(`⚠ ${missing.length} slug(s) not found in lib/blog-posts.js (are all clusters merged?):`);
    missing.forEach((s) => console.warn(`   - ${s}`));
    console.warn("");
  }
  console.log(`✔ ${SCHEDULE_ORDER.length - missing.length} post(s) scheduled${changes.length ? `, ${changes.length} date(s) changed` : " (no date changes needed)"}.`);
  if (changes.length) {
    const firstFew = changes.slice(0, 5);
    firstFew.forEach((c) => console.log(`   ${c.slug}: ${c.from} → ${c.to}`));
    if (changes.length > 5) console.log(`   … and ${changes.length - 5} more`);
    const last = SCHEDULE_ORDER.length - missing.length - 1;
    const lastDate = new Date(startDate);
    lastDate.setUTCDate(lastDate.getUTCDate() + Math.floor(last / perDay));
    console.log(`\n   Rollout: ${ymd(startDate)} → ${ymd(lastDate)} (last post goes live).`);
  }

  if (dryRun) {
    console.log("\n(dry run — no file written)\n");
    return;
  }

  writeFileSync(BLOG_FILE, src, "utf8");
  console.log(`\n✔ Wrote lib/blog-posts.js. Review the diff, commit, and merge to roll out 1/day.\n`);
}

main();
