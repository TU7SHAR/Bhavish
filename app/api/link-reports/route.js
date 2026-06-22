import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Called after user logs in — links all reports with matching email to their user_id
export async function POST(request) {
  try {
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

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Link all reports that match this user's email but have no user_id
    const { data, error } = await supabase
      .from("reports")
      .update({ user_id: user.id })
      .eq("email", user.email)
      .is("user_id", null);

    if (error) {
      console.error("Link reports error:", error);
      return NextResponse.json(
        { error: "Failed to link reports" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Linked reports to your account`,
    });
  } catch (error) {
    console.error("Link reports error:", error);
    return NextResponse.json(
      { error: "Failed to link reports." },
      { status: 500 }
    );
  }
}
