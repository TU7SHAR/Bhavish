import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata = {
  title: "My Plan",
  description: "View your active BhavishAI plan, report usage, and upgrade options.",
};

// Marketing allowance for Founder members (5 reports/month for 2 years).
const FOUNDER_MONTHLY_ALLOWANCE = 5;

export default async function MyPlans() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .eq("user_id", user.id)
    .in("payment_status", ["paid", "founder"])
    .order("created_at", { ascending: false });

  const all = Array.isArray(reports) ? reports : [];

  // Derived plan state
  const isFounder = all.some((r) => r.is_founder_member);
  const hasGuidance = all.some((r) => r.has_12_month_guidance);
  const paidReports = all.filter((r) => r.payment_status === "paid");
  const totalReports = all.length;

  // Reports created this calendar month (used for founder monthly usage)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const reportsThisMonth = all.filter((r) => new Date(r.created_at) >= startOfMonth).length;

  // Founder-free reports used this month (for the monthly quota view)
  const founderUsedThisMonth = all.filter(
    (r) => (r.is_founder_free || r.payment_status === "founder") && new Date(r.created_at) >= startOfMonth
  ).length;
  const founderRemaining = Math.max(0, FOUNDER_MONTHLY_ALLOWANCE - founderUsedThisMonth);

  // Founder validity window (2 years from the founder purchase report's date)
  const founderReport = all.find((r) => r.is_founder_member);
  const founderStart = founderReport ? new Date(founderReport.created_at) : null;
  const founderEnd = founderStart
    ? new Date(founderStart.getFullYear() + 2, founderStart.getMonth(), founderStart.getDate())
    : null;

  const memberSince = all.length
    ? new Date(all[all.length - 1].created_at)
    : new Date(user.created_at || Date.now());

  const fmt = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  // Plan label
  const planLabel = isFounder ? "Founder Access" : paidReports.length > 0 ? "Single Reports" : "No Active Plan";

  return (
    <>
      <Header />
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold">My Plan</h1>
              <p className="text-muted mt-1">{user.user_metadata?.full_name || user.email}</p>
            </div>
            <Link
              href="/dashboard"
              className="bg-primary/15 hover:bg-primary/25 text-primary-light px-5 py-2.5 rounded-full text-sm font-medium transition-all"
            >
              View My Reports →
            </Link>
          </div>

          {/* Current plan card */}
          {isFounder ? (
            <div className="relative overflow-hidden bg-gradient-to-br from-accent/15 via-accent/5 to-transparent border-2 border-accent/40 rounded-2xl p-6 mb-6">
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-accent/10 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">🎖️</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-accent">Founder Access</h2>
                      <span className="bg-accent/20 text-accent text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    </div>
                    <p className="text-muted text-sm mt-0.5">
                      {FOUNDER_MONTHLY_ALLOWANCE} reports / month
                      {founderEnd ? ` · valid until ${fmt(founderEnd)}` : " · valid 2 years"}
                    </p>
                  </div>
                </div>

                {/* Usage bar */}
                <div className="bg-surface/50 border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted">Reports used this month</span>
                    <span className="font-semibold text-foreground">
                      {founderUsedThisMonth} / {FOUNDER_MONTHLY_ALLOWANCE}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent to-accent-light rounded-full transition-all"
                      style={{ width: `${Math.min(100, (founderUsedThisMonth / FOUNDER_MONTHLY_ALLOWANCE) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted mt-2">
                    <span>{founderRemaining} remaining</span>
                    <span>Resets {fmt(nextReset)}</span>
                  </div>
                </div>

                <Link
                  href="/founder/new"
                  className="inline-block mt-4 bg-accent hover:bg-accent-light text-black px-6 py-3 rounded-full text-sm font-semibold transition-all"
                >
                  🎁 Generate a Report
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Current Plan</p>
                  <h2 className="text-xl font-bold">{planLabel}</h2>
                  <p className="text-muted text-sm mt-1">
                    {paidReports.length > 0
                      ? `You've purchased ${paidReports.length} report${paidReports.length > 1 ? "s" : ""}. Each stays available to you for life.`
                      : "You don't have any reports yet. Get your first personalized report in about 60 seconds."}
                  </p>
                </div>
                <Link
                  href="/get-report"
                  className="shrink-0 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-full text-sm font-medium transition-all"
                >
                  {paidReports.length > 0 ? "+ New Report" : "Get My Report"}
                </Link>
              </div>
            </div>
          )}

          {/* Add-on: 12-Month Guidance */}
          {hasGuidance && (
            <div className="bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent border border-blue-400/40 rounded-2xl p-5 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <div className="flex-1">
                  <p className="font-bold text-blue-300">12-Month Guidance Pack</p>
                  <p className="text-muted text-sm">Your month-by-month guidance is active. View it inside your report.</p>
                </div>
                <span className="bg-blue-500/20 text-blue-300 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0">
                  Active
                </span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-[10px] text-muted uppercase tracking-wider">Total Reports</p>
              <p className="text-2xl font-bold mt-1">{totalReports}</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-[10px] text-muted uppercase tracking-wider">This Month</p>
              <p className="text-2xl font-bold mt-1">{reportsThisMonth}</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-4 col-span-2 sm:col-span-1">
              <p className="text-[10px] text-muted uppercase tracking-wider">Member Since</p>
              <p className="text-lg font-bold mt-1">{fmt(memberSince)}</p>
            </div>
          </div>

          {/* Upgrade / explore */}
          {!isFounder && (
            <div className="bg-surface border border-border rounded-2xl p-6 text-center">
              <h3 className="text-lg font-bold mb-1">Want more than one report?</h3>
              <p className="text-muted text-sm mb-4 max-w-md mx-auto">
                Explore Founder Access and other options — ask about career, love, money, family and future decisions
                over time.
              </p>
              <Link
                href="/plans"
                className="inline-block bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-full text-sm font-medium transition-all"
              >
                Explore Plans →
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
