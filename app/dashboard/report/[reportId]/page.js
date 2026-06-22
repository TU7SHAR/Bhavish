import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Header from "../../../components/Header";
import Footer from "../../../components/Footer";

export async function generateMetadata({ params }) {
  return { title: "View Report - Dashboard" };
}

export default async function ViewReport({ params }) {
  const { reportId } = await params;
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: report } = await supabase
    .from("reports")
    .select("*")
    .eq("report_id", reportId)
    .eq("user_id", user.id)
    .eq("payment_status", "paid")
    .single();

  if (!report) notFound();

  const sections = report.sections || [];

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
          </div>

          {/* Summary */}
          {report.summary && (
            <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6 mb-8">
              <h2 className="text-lg font-bold text-primary-light mb-2">Chart Summary</h2>
              <p className="text-muted italic leading-relaxed">{report.summary}</p>
            </div>
          )}

          {/* All Sections */}
          <div className="space-y-8">
            {sections.map((section, i) => (
              <div
                key={i}
                className="bg-surface border border-border rounded-2xl p-6 md:p-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-primary/20 text-primary text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center">
                    {i + 1}
                  </span>
                  <h2 className="text-xl md:text-2xl font-bold">{section.title.replace(/^\d+\.\s*/, "")}</h2>
                </div>
                <div className="text-muted leading-relaxed whitespace-pre-line">
                  {section.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
