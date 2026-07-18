/**
 * Plan definitions — the SINGLE SOURCE OF TRUTH for pricing and packaging.
 *
 * The frontend only ever sends a `planId` (+ an optional `includeGuidance`
 * flag for Essential). The SERVER decides the price. Never trust a price or
 * amount coming from the client.
 *
 * Three visible tiers (one-time purchases):
 *   Essential  ₹299  — 10 core sections + personal-question answer
 *                      (+ ₹149 optional 12-month guidance → ₹448)
 *   Premium    ₹499  — 20 core sections + personal answer + 12-month guidance   ⭐ MOST POPULAR
 *   Master     ₹999  — everything in Premium + a 7-section concern-specific
 *                      deep-dive + a 24-month roadmap (generated separately)
 *
 * Founder (₹999 recurring-style access) is NOT sold to new users anymore.
 * Existing Founder members are grandfathered via the legacy `is_founder_member`
 * field and their access is unaffected.
 */

// Individual price points (INR). guidanceAddon is the optional Essential add-on.
export const PRICE = {
  essential: 299,
  guidanceAddon: 149,
  premium: 499,
  master: 999,
};

export const GUIDANCE_MONTHS = 12; // length of the 12-month guidance pack
export const MASTER_ROADMAP_MONTHS = 24; // Master's extended roadmap horizon
export const MASTER_DEEP_DIVE_SECTIONS = 7; // concern-specific deep-dive sections

// Base tier definitions. Prices here are the STARTING price (before add-ons).
export const PLAN_TIERS = {
  essential: {
    id: "essential",
    tier: "essential",
    name: "Essential",
    basePrice: PRICE.essential,
    coreSections: 10, // + 1 personal-question answer
    guidanceIncluded: false,
    guidanceAddonAvailable: true, // the +₹149 checkbox lives here
    deepDive: false,
  },
  premium: {
    id: "premium",
    tier: "premium",
    name: "Premium",
    basePrice: PRICE.premium,
    coreSections: 20,
    guidanceIncluded: true,
    guidanceAddonAvailable: false,
    deepDive: false,
  },
  master: {
    id: "master",
    tier: "master",
    name: "Master",
    basePrice: PRICE.master,
    coreSections: 20,
    guidanceIncluded: true,
    guidanceAddonAvailable: false,
    deepDive: true,
    roadmapMonths: MASTER_ROADMAP_MONTHS,
    deepDiveSections: MASTER_DEEP_DIVE_SECTIONS,
  },
};

export const VALID_PLAN_IDS = Object.keys(PLAN_TIERS);

/**
 * Resolve a concrete, server-authoritative purchase from a planId + options.
 *
 * @param {string} planId - "essential" | "premium" | "master"
 * @param {object} [opts]
 * @param {boolean} [opts.includeGuidance] - only honored for Essential
 * @returns {null | {
 *   planId: string, tier: string, price: number, guidanceMonths: number,
 *   coreSections: number, deepDive: boolean, roadmapMonths: number
 * }}
 */
export function resolvePlan(planId, { includeGuidance = false } = {}) {
  const plan = PLAN_TIERS[planId];
  if (!plan) return null;

  // Guidance is included on Premium/Master; optional (paid add-on) on Essential.
  const guidanceOn = plan.guidanceIncluded || (plan.guidanceAddonAvailable && !!includeGuidance);
  const price =
    plan.basePrice +
    (plan.guidanceAddonAvailable && includeGuidance ? PRICE.guidanceAddon : 0);

  return {
    planId: plan.id,
    tier: plan.tier,
    price,
    guidanceMonths: guidanceOn ? GUIDANCE_MONTHS : 0,
    coreSections: plan.coreSections,
    deepDive: !!plan.deepDive,
    roadmapMonths: plan.roadmapMonths || 0,
  };
}

/**
 * Backward-compatibility: the old flow only had a single ₹299 report with an
 * optional ₹149 bump (`includeBump`). Map that onto the new Essential tier so
 * existing clients / in-flight orders keep working during rollout.
 */
export function resolveLegacyBump(includeBump) {
  return resolvePlan("essential", { includeGuidance: !!includeBump });
}

/** Human-friendly label for a stored plan_tier value (incl. legacy labels). */
export function planLabel(tier) {
  return (
    {
      essential: "Essential",
      premium: "Premium",
      master: "Master",
      premium_legacy: "Complete Report",
      legacy_founder: "Founder Access",
    }[tier] || "Report"
  );
}
