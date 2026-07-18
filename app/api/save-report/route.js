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
    const rateCheck = await saveLimiter(request);
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
      attribution,
      personalQuestion,
      city,
      visitorId,
      chartData,
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
    //
    // SECURITY: This is a PUBLIC endpoint. It must NEVER accept payment-related
    // fields from the client. Only server-side code (verify-payment, webhook,
    // fulfill-payment) may mark a report as paid. Accepting paymentStatus from
    // the client would let anyone bypass the paywall entirely.
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
      // FORCED: public endpoint always writes "unpaid". Only server-side Razorpay
      // verification code may ever set "paid".
      payment_status: "unpaid",
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
    if (deviceType && deviceType !== "unknown") data.device_type = deviceType;
    data.preview_generated_at = new Date().toISOString();

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

    // Trigger email sequence generation server-side for unpaid leads with email.
    if (email && email.trim()) {
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
