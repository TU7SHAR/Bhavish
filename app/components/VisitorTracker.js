"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Persistent anonymous visitor ID (survives browser close)
const VISITOR_KEY = "bhavish_visitor_id";
// Session ID (resets when tab is closed)
const SESSION_KEY = "bhavish_session_id";

function generateId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getOrCreateVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = generateId();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function getOrCreateSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = generateId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function getDeviceType() {
  if (typeof window === "undefined") return "unknown";
  return window.innerWidth < 768 ? "mobile" : "desktop";
}

// Export so other components (save-report, payment) can attach it to their requests
export function getVisitorId() {
  try {
    return localStorage.getItem(VISITOR_KEY) || null;
  } catch {
    return null;
  }
}

export default function VisitorTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTracked = useRef("");

  useEffect(() => {
    // Only track meaningful pages (skip API routes, static assets)
    const trackablePages = [
      "/",
      "/get-report",
      "/report/preview",
      "/report/full",
      "/login",
      "/dashboard",
      "/blog",
      "/contact",
      "/pricing",
    ];

    // Track if it's a trackable page or starts with a tracked prefix
    const shouldTrack = trackablePages.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );
    if (!shouldTrack) return;

    // Debounce: don't re-track the exact same page in the same render cycle
    const trackKey = pathname + searchParams.toString();
    if (trackKey === lastTracked.current) return;
    lastTracked.current = trackKey;

    const visitorId = getOrCreateVisitorId();
    const sessionId = getOrCreateSessionId();
    if (!visitorId || !sessionId) return;

    // Fire and forget — don't block rendering
    const payload = {
      visitor_id: visitorId,
      session_id: sessionId,
      page: pathname,
      device_type: getDeviceType(),
      utm_source: searchParams.get("utm_source") || null,
      utm_medium: searchParams.get("utm_medium") || null,
      utm_campaign: searchParams.get("utm_campaign") || null,
      referrer: document.referrer || null,
    };

    fetch("/api/track/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently fail — tracking should never break the user experience
    });
  }, [pathname, searchParams]);

  return null;
}
