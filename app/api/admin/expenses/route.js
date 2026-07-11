import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";

// Admin expenses CRUD — powers the Economics tab.
//
// GET  /api/admin/expenses         → list all expenses (newest first)
// GET  /api/admin/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD → filtered by date range
// POST /api/admin/expenses         → add a new expense
// DELETE /api/admin/expenses       → delete an expense by id (body: { id })

export const maxDuration = 15;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// GET — list expenses
export async function GET(request) {
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const supabase = getSupabase();
  let query = supabase.from("expenses").select("*").order("date", { ascending: false });

  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error } = await query;

  if (error) {
    // Table might not exist yet — return empty gracefully
    if (error.message?.includes("relation") || error.code === "42P01") {
      return NextResponse.json({ expenses: [], tableNotCreated: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expenses: data || [] });
}

// POST — add expense
export async function POST(request) {
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  try {
    const { category, label, amount, date, notes } = await request.json();

    if (!category || !label || !amount) {
      return NextResponse.json({ error: "category, label, and amount are required" }, { status: 400 });
    }

    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }

    const validCategories = ["ads", "tools", "services", "infra", "other"];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: `category must be one of: ${validCategories.join(", ")}` }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.from("expenses").insert({
      category,
      label: label.trim(),
      amount: parseFloat(amount),
      date: date || new Date().toISOString().split("T")[0],
      notes: notes?.trim() || null,
    }).select().single();

    if (error) {
      if (error.message?.includes("relation") || error.code === "42P01") {
        return NextResponse.json({ error: "Expenses table not created yet. Run the SQL migration first." }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, expense: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — remove expense by id
export async function DELETE(request) {
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase.from("expenses").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
