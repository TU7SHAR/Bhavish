import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";
import { selectRecipients } from "../../../../lib/broadcast-filters.js";

// Admin: preview how many UNIQUE people match the broadcast filters — without
// sending anything. This is what powers the live "this matches N people" count
// and answers the "is my 1303 real or duplicates?" question, because
// selectRecipients() de-duplicates by email.
//
// POST /api/admin/broadcast-preview
// Header: Authorization: Bearer <ADMIN_SECRET>
// Body: { status?, tier?, gender?, guidance?, dateFrom?, dateTo? }
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request) {
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  let filters = {};
  try {
    filters = (await request.json()) || {};
  } catch {
    // empty body = no filters = everyone (still de-duped)
  }

  try {
    const { recipients, total, error } = await selectRecipients(filters);
    if (error) {
      return NextResponse.json({ ok: false, error }, { status: 200 });
    }

    // A small sample so the admin can eyeball who's included before sending.
    const sample = recipients.slice(0, 8).map((r) => ({
      email: r.email,
      name: r.name || "(no name)",
    }));

    return NextResponse.json({ ok: true, total, sample });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
