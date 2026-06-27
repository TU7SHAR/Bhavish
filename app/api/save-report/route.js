import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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
    } = await request.json();

    if (!reportId || !name || !sections) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create Supabase admin client (uses service role for inserting without auth)
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

    // Save report to database
    const { data, error } = await supabase.from("reports").upsert(
      {
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
        attribution: attribution || null,
      },
      { onConflict: "report_id" }
    );

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
