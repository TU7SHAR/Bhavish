"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

// Captures UTM params + fbclid + gclid + landing page from URL on first visit.
// Stores in sessionStorage so they persist across page navigations.
// Only sets on FIRST visit (doesn't overwrite if already captured).
const ATTRIBUTION_KEY = "bhavish_attribution";

const TRACKED_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "ref",
];

export default function AttributionCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      // Only capture once per session — first touch attribution
      const existing = sessionStorage.getItem(ATTRIBUTION_KEY);
      if (existing) return;

      const attribution = {};
      let hasAny = false;

      for (const param of TRACKED_PARAMS) {
        const value = searchParams.get(param);
        if (value) {
          attribution[param] = value;
          hasAny = true;
        }
      }

      // Always capture landing page + referrer + timestamp
      attribution.landing_page = window.location.pathname + window.location.search;
      attribution.referrer = document.referrer || null;
      attribution.landed_at = new Date().toISOString();
      attribution.user_agent = navigator.userAgent;

      sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));

      // Also save to localStorage as backup (survives browser close)
      localStorage.setItem(ATTRIBUTION_KEY + "_backup", JSON.stringify(attribution));
    } catch (e) {
      // Silently fail if storage is blocked
    }
  }, [searchParams]);

  return null;
}

// Helper: get stored attribution data (used by form submission)
export function getAttribution() {
  try {
    const data = sessionStorage.getItem(ATTRIBUTION_KEY);
    if (data) return JSON.parse(data);
    // Fallback to localStorage backup
    const backup = localStorage.getItem(ATTRIBUTION_KEY + "_backup");
    if (backup) return JSON.parse(backup);
  } catch (e) {}
  return null;
}
