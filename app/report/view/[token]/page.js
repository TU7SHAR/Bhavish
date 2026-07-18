import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Header from "../../../components/Header";
import Footer from "../../../components/Footer";
import KundliChartsSection from "../../../components/KundliCharts";
import GuidancePack from "../../../components/GuidancePack";

// Public, login-free report access via a secure per-report token.
//
// A paid customer opens https://www.bhavishai.in/report/view/<token> and sees
// their full report — no Google login required. This is the recovery path for
// customers (especially UPI) who never made an account or signed in with a
// different email than the one on their order.
//
// Security: the token is 192 bits of entropy (unguessable). We still verify
// payment_status before rendering. Uses the service-role client to bypass RLS,
// which is safe because access is gated by the secret token in the URL.

export const dynamic = "force-dynamic";

const isGuidanceSection = (title) => /guidance pack|12-month|12 month/i.test(title || "");
const isDeepDiveSection = (title) => {
  if (!title) return false;
  return title.toLowerCase().includes("deep dive") || title.toLowerCase().includes("deep-dive") || /\b24[- ]month.*roadmap/i.test(title);
};

export async function generateMetadata() {
  // Never index these private report links.
  return {
    title: "Your Report",
    robots: { index: false, follow: false },
  };
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export default async function ViewReportByToken({ params }) {
  const { token } = await params;

  if (!token || token.length < 16) notFound();

  const supabase = getServiceClient();

  const { data: report, error } = await supabase
    .from("reports")
    .select("*")
    .eq("access_token", token)
    .single();

  if (error || !report) notFound();

  // Only paid / founder reports are viewable.
  if (!["paid", "founder"].includes(report.payment_status)) notFound();

  const sections = Array.isArray(report.sections) ? report.sections : [];
  const hasGuidance = sections.some((s) => isGuidanceSection(s.title));

  // Report still generating (e.g., webhook fulfilled payment but generation
  // is queued/failed). Show a friendly waiting state instead of a broken page.
  if (sections.length === 0) {
    return (
      <>
        <Header />
        <main className="flex-1 pt-24 pb-16">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <div className="bg-surface border border-border rounded-2xl p-10">
              <div className="text-5xl mb-4">🪐</div>
              <h1 className="text-2xl font-bold mb-2">Your report is being prepared</h1>
              <p className="text-muted mb-4">
                Your payment is confirmed. We&apos;re generating {report.name}&apos;s
                personalized report now — it will appear here shortly and is also
                sent to your email. Please refresh this page in a minute.
              </p>
              <p className="text-muted/70 text-sm">Report ID: {report.report_id}</p>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Report Header */}
          <div className="bg-surface border border-border rounded-2xl p-8 mb-8 text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {report.name}&apos;s Vedic Astrology Report
            </h1>
            <p className="text-muted mb-4">
              Report ID: {report.report_id} | Generated: {new Date(report.created_at).toLocaleDateString("en-IN")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted">
              <span>DOB: {new Date(report.date_of_birth).toLocaleDateString("en-IN")}</span>
              <span>Time: {report.time_of_birth}</span>
              <span>Place: {report.place_of_birth}</span>
            </div>
            <p className="text-muted/60 text-xs mt-4">
              Bookmark this page — you can return to your report anytime with this link.
            </p>
          </div>

          {/* Summary */}
          {report.summary && (
            <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6 mb-8">
              <h2 className="text-lg font-bold text-primary-light mb-2">Chart Summary</h2>
              <p className="text-muted italic leading-relaxed">{report.summary}</p>
            </div>
          )}

          {/* 12-Month Guidance callout */}
          {hasGuidance && (
            <a
              href="#guidance-pack"
              className="block bg-gradient-to-br from-blue-500/15 via-primary/10 to-transparent border border-blue-400/30 rounded-2xl p-5 mb-8 hover:border-blue-400/60 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <div className="flex-1">
                  <p className="font-bold text-blue-300">You have the 12-Month Guidance Pack</p>
                  <p className="text-muted text-sm">Your month-by-month guide is included below.</p>
                </div>
                <span className="text-blue-300 text-sm font-medium group-hover:translate-x-0.5 transition-transform">View ↓</span>
              </div>
            </a>
          )}

          {/* Kundli Charts, Planet Table, Lucky Factors, Remedies */}
          {report.chart_data && <KundliChartsSection chartData={report.chart_data} />}

          {/* All Sections */}
          <div className="space-y-8">
            {sections.map((section, i) => {
              if (isGuidanceSection(section.title)) {
                return (
                  <div key={i} id="guidance-pack" className="scroll-mt-24">
                    <GuidancePack title={section.title} content={section.content} />
                  </div>
                );
              }
              const deepDive = isDeepDiveSection(section.title);
              return (
                <div
                  key={i}
                  className={`bg-surface border rounded-2xl p-6 md:p-8 ${
                    deepDive ? "border-accent/40" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center ${
                      deepDive ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"
                    }`}>
                      {i + 1}
                    </span>
                    <h2 className="text-xl md:text-2xl font-bold">{(section.title || "").replace(/^\d+\.\s*/, "")}</h2>
                  </div>
                  <div className="text-muted leading-relaxed whitespace-pre-line">
                    {section.content}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
