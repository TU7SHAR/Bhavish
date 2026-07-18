import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { saveLimiter } from "../../../lib/rate-limit.js";
import { sanitizeName, sanitizePlace, sanitizeForPrompt } from "../../../lib/sanitize.js";
import { createServiceClient } from "../../../lib/supabase-service.js";

// Detect device type from User-Agent header
function detectDevice(userAgent) {
  if (!userAgent) return "unknown";
  if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone|opera mini|iemobile/i.test(userAgent)) {
    return "mobile";
  }
  return "desktop";
}

export async function POST(request) {
  try {
    // Rate limiting — prevent fake lead injection
    const rateCheck = saveLimiter(request);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.error }, { status: 429 });
    }

    const {
      reportId,
      name,
      email,
      dateOfBirth,
      timeOfBirth,
      placeOfBirth,
      gender,
      summary,
      sections,
      paymentId,
      paymentStatus,
      attribution,
      personalQuestion,
      city,
      visitorId,
      chartData,
      reportStatus,
    } = await request.json();

    if (!reportId || !name || !sections) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Detect device type from request headers
    const userAgent = request.headers.get("user-agent") || "";
    const deviceType = detectDevice(userAgent);

    // Auth client (cookie-based) — used ONLY to read the logged-in user so we
    // can link the report to their account. All actual DB writes go through the
    // service-role client below, which is required now that RLS is enabled
    // (guest leads have no auth session and could not write otherwise).
    const cookieStore = await cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
          },
        },
      }
    );

    // Service-role client for the write (bypasses RLS).
    const supabase = createServiceClient();

    // Check if user is logged in
    const { data: { user } } = await authClient.auth.getUser();

    // CRITICAL: Only include fields that are ACTUALLY provided in this request.
    // If a field is not passed (e.g. attribution on second save after payment),
    // we must NOT include it — otherwise upsert sets it to null, wiping the
    // value that was stored on the first save.
    const data = {
      report_id: reportId,
      name,
      email: email || user?.email || null,
      date_of_birth: dateOfBirth,
      time_of_birth: timeOfBirth,
      place_of_birth: placeOfBirth,
      gender,
      summary,
      sections,
      payment_id: paymentId || null,
      payment_status: paymentStatus || "unpaid",
    };

    // Only set user_id if user is logged in (don't wipe existing with null)
    if (user?.id) data.user_id = user.id;

    // Only include attribution if actually provided (prevents wipe on 2nd save)
    if (attribution) data.attribution = attribution;

    // Enhanced tracking fields — only include when provided (prevents wipe)
    if (personalQuestion) data.personal_question = personalQuestion;
    if (city) data.city = city;
    if (visitorId) data.visitor_id = visitorId;
    if (chartData) data.chart_data = chartData;
    if (reportStatus) data.report_status = reportStatus;
    if (deviceType && deviceType !== "unknown") data.device_type = deviceType;
    if (paymentStatus !== "paid") data.preview_generated_at = new Date().toISOString();

    // Try with all fields first (works after migration)
    let { error } = await supabase.from("reports").upsert(data, { onConflict: "report_id" });

    // If enhanced columns don't exist yet, strip them and retry
    if (error) {
      console.warn("Enhanced save failed, falling back:", error.message);
      const { personal_question, city: c, device_type, preview_generated_at, visitor_id, chart_data, report_status, ...coreOnly } = data;
      const fallback = await supabase.from("reports").upsert(coreOnly, { onConflict: "report_id" });
      error = fallback.error;
    }

    if (error) {
      console.error("Supabase save error:", error);
      return NextResponse.json(
        { error: "Failed to save report. Report is still available on-screen." },
        { status: 500 }
      );
    }

    // SECURITY FIX: Trigger email sequence generation server-side.
    // Previously this was called from the frontend (unauthenticated).
    // Now it runs here with internal auth after a successful unpaid lead save.
    if (paymentStatus !== "paid" && email && email.trim()) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bhavishai.in";
      const internalSecret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
      if (internalSecret) {
        fetch(`${baseUrl}/api/generate-email-sequence`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${internalSecret}`,
          },
          body: JSON.stringify({
            reportId,
            name,
            summary,
            sections,
            dateOfBirth,
            placeOfBirth,
            personalQuestion: personalQuestion || "",
          }),
        }).catch((err) => console.error("Email sequence generation failed (non-critical):", err.message));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save report error:", error);
    return NextResponse.json(
      { error: "Failed to save report." },
      { status: 500 }
    );
  }
}
