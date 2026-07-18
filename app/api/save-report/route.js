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

// PUBLIC endpoint: saves the initial PREVIEW lead to the database.
//
// SECURITY RULES:
// 1. This endpoint can only CREATE new unpaid rows or UPDATE existing UNPAID rows.
// 2. It NEVER touches a row whose payment_status is already "paid" or "founder".
// 3. It NEVER accepts payment_status, payment_id, plan_tier, plan_price,
//    report_status from the client — those are server-only fields.
// 4. Server-side sanitization is applied to name/place/question.

export async function POST(request) {
  try {
    // Rate limiting
    const rateCheck = await saveLimiter(request);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.error }, { status: 429 });
    }

    const body = await request.json();
    const {
      reportId,
      email,
      dateOfBirth,
      timeOfBirth,
      gender,
      summary,
      sections,
      attribution,
      city,
      visitorId,
      chartData,
    } = body;

    // Server-side sanitization (defense in depth — don't trust browser sanitization)
    const name = sanitizeName(body.name, 100);
    const placeOfBirth = sanitizePlace(body.placeOfBirth, 200);
    const personalQuestion = sanitizeForPrompt(body.personalQuestion || "", 300);

    if (!reportId || !name || !sections) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userAgent = request.headers.get("user-agent") || "";
    const deviceType = detectDevice(userAgent);

    // Auth client — only for reading logged-in user
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
    const supabase = createServiceClient();
    const { data: { user } } = await authClient.auth.getUser();

    // Check if this report already exists
    const { data: existing } = await supabase
      .from("reports")
      .select("report_id, payment_status")
      .eq("report_id", reportId)
      .maybeSingle();

    // CRITICAL GUARD: Never overwrite a paid or founder row.
    // If the browser calls save-report after payment (legacy code path),
    // we simply return success without touching the paid row.
    if (existing && ["paid", "founder"].includes(existing.payment_status)) {
      return NextResponse.json({ success: true, note: "already_paid" });
    }

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
      payment_status: "unpaid",
    };

    if (user?.id) data.user_id = user.id;
    if (attribution) data.attribution = attribution;
    if (personalQuestion) data.personal_question = personalQuestion;
    if (city) data.city = city;
    if (visitorId) data.visitor_id = visitorId;
    if (chartData) data.chart_data = chartData;
    if (deviceType && deviceType !== "unknown") data.device_type = deviceType;
    data.preview_generated_at = new Date().toISOString();

    let error;
    if (!existing) {
      // INSERT new row (first save — preview just generated)
      ({ error } = await supabase.from("reports").insert(data));
    } else {
      // UPDATE existing unpaid row (user re-submitted or page refreshed)
      const { report_id, payment_status, ...updateFields } = data;
      ({ error } = await supabase
        .from("reports")
        .update(updateFields)
        .eq("report_id", reportId)
        .eq("payment_status", "unpaid")); // extra guard
    }

    // Fallback: strip enhanced columns if they don't exist yet
    if (error) {
      console.warn("Save failed, retrying with core fields:", error.message);
      const { personal_question, city: c, device_type, preview_generated_at, visitor_id, chart_data, ...coreOnly } = data;
      if (!existing) {
        ({ error } = await supabase.from("reports").insert(coreOnly));
      } else {
        const { report_id, payment_status, ...coreUpdate } = coreOnly;
        ({ error } = await supabase.from("reports").update(coreUpdate).eq("report_id", reportId).eq("payment_status", "unpaid"));
      }
    }

    if (error) {
      console.error("Supabase save error:", error);
      return NextResponse.json({ error: "Failed to save report." }, { status: 500 });
    }

    // Trigger email sequence for unpaid leads with email
    if (email && email.trim()) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bhavishai.in";
      const internalSecret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
      if (internalSecret) {
        fetch(`${baseUrl}/api/generate-email-sequence`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${internalSecret}` },
          body: JSON.stringify({ reportId, name, summary, sections, dateOfBirth, placeOfBirth, personalQuestion }),
        }).catch((err) => console.error("Email sequence failed (non-critical):", err.message));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save report error:", error);
    return NextResponse.json({ error: "Failed to save report." }, { status: 500 });
  }
}
