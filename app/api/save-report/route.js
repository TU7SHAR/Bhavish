import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient(
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

    // Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();

    // Core report data (always works — these columns already exist)
    const coreData = {
      report_id: reportId,
      user_id: user?.id || null,
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

    // Only set attribution if it was actually provided (avoid overwriting existing data)
    if (attribution) {
      coreData.attribution = attribution;
    }

    // Enhanced tracking fields (only work after migration is run)
    const enhancedData = {
      ...coreData,
      personal_question: personalQuestion || null,
      city: city || null,
      device_type: deviceType,
      preview_generated_at: paymentStatus !== "paid" ? new Date().toISOString() : undefined,
    };

    // Try with enhanced fields first
    let { error } = await supabase.from("reports").upsert(enhancedData, { onConflict: "report_id" });

    // If it fails (columns don't exist yet), fall back to core-only save
    if (error) {
      console.warn("Enhanced save failed, falling back to core save:", error.message);
      const fallback = await supabase.from("reports").upsert(coreData, { onConflict: "report_id" });
      error = fallback.error;
    }

    if (error) {
      console.error("Supabase save error:", error);
      return NextResponse.json(
        { error: "Failed to save report. Report is still available on-screen." },
        { status: 500 }
      );
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
