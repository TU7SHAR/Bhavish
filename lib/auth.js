/**
 * Shared authentication utilities for BhavishAI API routes.
 * 
 * Uses timing-safe comparison to prevent timing attacks on secrets.
 * Provides consistent auth patterns across admin, cron, and internal routes.
 */

import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * Timing-safe string comparison.
 * Prevents attackers from brute-forcing secrets character-by-character
 * by measuring response time differences.
 * 
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} - Whether strings are equal
 */
export function safeCompare(a, b) {
  if (!a || !b) return false;
  // Pad to same length to prevent length-based timing leaks
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against self to maintain constant time, then return false
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verifies admin/cron authorization from request headers.
 * Checks Authorization: Bearer <secret> against ADMIN_SECRET or CRON_SECRET.
 * 
 * @param {Request} request - The incoming request
 * @returns {{ authorized: boolean, error?: Response }} 
 * 
 * Usage:
 *   const auth = verifyAdmin(request);
 *   if (!auth.authorized) return auth.error;
 */
export function verifyAdmin(request) {
  const authHeader = request.headers.get("authorization") || "";
  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;

  if (!adminSecret) {
    // If no secret is configured, deny all access (fail-closed)
    return {
      authorized: false,
      error: NextResponse.json(
        { error: "Server configuration error: no admin secret configured" },
        { status: 500 }
      ),
    };
  }

  const expectedHeader = `Bearer ${adminSecret}`;

  if (!safeCompare(authHeader, expectedHeader)) {
    return {
      authorized: false,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { authorized: true };
}

/**
 * Verifies cron authorization (same as admin but named for clarity).
 * Checks against CRON_SECRET specifically.
 * 
 * @param {Request} request - The incoming request
 * @returns {{ authorized: boolean, error?: Response }}
 */
export function verifyCron(request) {
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: "Server configuration error: no cron secret configured" },
        { status: 500 }
      ),
    };
  }

  const expectedHeader = `Bearer ${cronSecret}`;

  if (!safeCompare(authHeader, expectedHeader)) {
    return {
      authorized: false,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { authorized: true };
}

/**
 * Verifies internal API calls (server-to-server within the app).
 * Accepts either ADMIN_SECRET, CRON_SECRET, or a special internal token.
 * 
 * Used for routes that are called by other routes within the app
 * (e.g., send-report-email called after payment verification).
 * 
 * @param {Request} request - The incoming request
 * @returns {{ authorized: boolean, error?: Response }}
 */
export function verifyInternal(request) {
  const authHeader = request.headers.get("authorization") || "";
  const internalSecret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;

  if (!internalSecret) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      ),
    };
  }

  const expectedHeader = `Bearer ${internalSecret}`;

  if (!safeCompare(authHeader, expectedHeader)) {
    return {
      authorized: false,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { authorized: true };
}

/**
 * Helper to get the internal auth header for server-to-server calls.
 * Use this when one API route needs to call another authenticated route.
 * 
 * @returns {Object} Headers object with Authorization
 */
export function getInternalAuthHeaders() {
  const secret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
  return {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  };
}
