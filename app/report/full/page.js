"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import KundliChartsSection from "../../components/KundliCharts";
import GuidancePack from "../../components/GuidancePack";

export default function FullReport() {
  const router = useRouter();
  const [reportData, setReportData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // Try sessionStorage first, then localStorage backup
    let storedReport = sessionStorage.getItem("reportData");
    let storedUser = sessionStorage.getItem("userData");
    const paymentVerified = sessionStorage.getItem("paymentVerified") || localStorage.getItem("paymentVerified_backup");
    const reportPending = sessionStorage.getItem("reportPending") === "true";

    if (!storedReport) storedReport = localStorage.getItem("reportData_backup");
    if (!storedUser) storedUser = localStorage.getItem("userData_backup");

    if (!storedReport || !storedUser) {
      router.push("/get-report");
      return;
    }

    if (!paymentVerified) {
      router.push("/report/preview");
      return;
    }

    setReportData(JSON.parse(storedReport));
    setUserData(JSON.parse(storedUser));
    setPending(reportPending);
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted">Loading your complete report...</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!reportData) return null;

  // Report failed the quality check — payment succeeded but the full report
  // isn't ready. Show an honest "being prepared" screen instead of a partial one.
  if (pending) {
    return (
      <>
        <Header />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
          <div className="max-w-lg mx-auto px-6 text-center">
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-green-400 mb-3">Payment Successful</h1>
            <div className="bg-surface border border-border rounded-2xl p-6 text-left">
              <p className="text-foreground leading-relaxed mb-3">
                Thank you, {userData.name}. Your personalised report is being prepared
                and will be {userData.email ? <>emailed to <strong>{userData.email}</strong></> : "sent to you"} shortly,
                after our final quality checks.
              </p>
              <p className="text-muted text-sm leading-relaxed">
                Our system double-checks every report for completeness before delivery, so this can take a few extra minutes.
                Your payment is confirmed{" "}
                <span className="font-mono text-xs">(Report ID: {reportData.reportId})</span>.
                If you don&apos;t receive it within a few hours, just reply to your confirmation email and we&apos;ll sort it out immediately.
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // Detect the ₹149 "12-Month Personal Guidance Pack" section (only present when
  // the add-on was purchased). Used to give the buyer a distinct on-screen experience.
  const isGuidanceSection = (title) => /guidance pack|12-month|12 month/i.test(title || "");
  const guidanceIndex = (reportData.sections || []).findIndex((s) => isGuidanceSection(s.title));
  const hasGuidance = guidanceIndex >= 0;

  return (
    <>
      <Header />
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Success Banner */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 mb-8 text-center">
            <div className="text-3xl mb-2">✅</div>
            <h2 className="text-xl font-bold text-green-400 mb-1">Payment Successful!</h2>
            <p className="text-muted text-sm">
              Your complete report is ready below.
              {userData.email && " A backup copy has been sent to your email."}
            </p>
          </div>

          {/* 12-Month Guidance Pack — buyer callout. Only shows when the ₹149 add-on was purchased. */}
          {hasGuidance && (
            <a
              href={`#section-${guidanceIndex}`}
              className="block bg-gradient-to-br from-blue-500/15 via-primary/10 to-transparent border border-blue-400/30 rounded-2xl p-6 mb-8 hover:border-blue-400/60 transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl shrink-0">📅</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 className="text-lg font-bold text-blue-300">Your 12-Month Guidance Pack is included</h2>
                    <span className="text-[10px] uppercase tracking-wider bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-semibold">₹149 add-on</span>
                  </div>
                  <p className="text-muted text-sm leading-relaxed">
                    A dedicated month-by-month guide for the next 12 months — best months, caution periods,
                    key timing windows and a practical monthly action plan for your career, money, relationships and health.
                  </p>
                  <span className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-blue-300 group-hover:gap-2 transition-all">
                    Jump to your guidance pack
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                  </span>
                </div>
              </div>
            </a>
          )}

          {/* Report Header */}
          <div className="bg-surface border border-border rounded-2xl p-8 mb-8 text-center">
            <div className="text-4xl mb-3">✨</div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {userData.name}&apos;s Complete Vedic Astrology Report
            </h1>
            <p className="text-muted mb-4">
              Generated by BhavishAI | Report ID: {reportData.reportId}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted">
              <span>DOB: {new Date(userData.dateOfBirth).toLocaleDateString("en-IN")}</span>
              <span>Time: {userData.timeOfBirth}</span>
              <span>Place: {userData.placeOfBirth}</span>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-bold text-primary-light mb-2">Chart Summary</h2>
            <p className="text-muted italic leading-relaxed">{reportData.summary}</p>
          </div>

          {/* Kundli Charts, Planet Table, Lucky Factors, Upay */}
          {reportData.chartData && (
            <KundliChartsSection chartData={reportData.chartData} />
          )}

          {/* Table of Contents */}
          <div className="bg-surface border border-border rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-bold mb-4">Table of Contents</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {reportData.sections.map((section, i) => {
                const guide = isGuidanceSection(section.title);
                return (
                  <a
                    key={i}
                    href={`#section-${i}`}
                    className={`flex items-center gap-2 text-sm transition-colors py-1 ${guide ? "text-blue-300 hover:text-blue-200 font-medium" : "text-muted hover:text-primary-light"}`}
                  >
                    <span className={`font-mono text-xs w-6 ${guide ? "text-blue-400" : "text-primary"}`}>{String(i + 1).padStart(2, "0")}</span>
                    {section.title.replace(/^\d+\.\s*/, "")}
                    {guide && <span className="text-[9px] uppercase tracking-wider bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-semibold">📅 Guidance</span>}
                  </a>
                );
              })}
            </div>
          </div>

          {/* All Sections */}
          <div className="space-y-8">
            {reportData.sections.map((section, i) => {
              if (isGuidanceSection(section.title)) {
                return (
                  <div key={i} id={`section-${i}`} className="scroll-mt-24">
                    <GuidancePack title={section.title} content={section.content} />
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  id={`section-${i}`}
                  className="bg-surface border border-border rounded-2xl p-6 md:p-8 scroll-mt-24"
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
              );
            })}
          </div>

          {/* Footer note */}
          <div className="mt-12 bg-surface border border-border rounded-2xl p-6 text-center">
            <p className="text-muted text-sm mb-4">
              This report was generated by BhavishAI using AI-powered Vedic astrology analysis.
              For major life decisions, please consult with qualified professionals.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={async () => {
                  const { jsPDF } = await import("jspdf");
                  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
                  const pageWidth = doc.internal.pageSize.getWidth();
                  const pageHeight = doc.internal.pageSize.getHeight();
                  const margin = 20;
                  const contentWidth = pageWidth - margin * 2;
                  let y = margin;

                  // Helper: add new page if needed
                  const checkPage = (needed = 20) => {
                    if (y + needed > pageHeight - margin) {
                      doc.addPage();
                      y = margin;
                    }
                  };

                  // Title page
                  doc.setFillColor(26, 26, 46);
                  doc.rect(0, 0, pageWidth, pageHeight, "F");
                  doc.setTextColor(167, 139, 250);
                  doc.setFontSize(28);
                  doc.text("BhavishAI", pageWidth / 2, 50, { align: "center" });
                  doc.setFontSize(12);
                  doc.setTextColor(200, 200, 200);
                  doc.text("AI-Powered Vedic Astrology Report", pageWidth / 2, 62, { align: "center" });
                  doc.setFontSize(22);
                  doc.setTextColor(255, 255, 255);
                  doc.text(userData.name, pageWidth / 2, 100, { align: "center" });
                  doc.setFontSize(11);
                  doc.setTextColor(180, 180, 180);
                  doc.text(`Date of Birth: ${new Date(userData.dateOfBirth).toLocaleDateString("en-IN")}`, pageWidth / 2, 115, { align: "center" });
                  doc.text(`Time: ${userData.timeOfBirth} | Place: ${userData.placeOfBirth}`, pageWidth / 2, 123, { align: "center" });
                  doc.text(`Report ID: ${reportData.reportId}`, pageWidth / 2, 135, { align: "center" });
                  doc.setTextColor(167, 139, 250);
                  doc.setFontSize(10);
                  doc.text("bhavishai.in", pageWidth / 2, pageHeight - 20, { align: "center" });

                  // Summary page
                  doc.addPage();
                  y = margin;
                  doc.setFillColor(255, 255, 255);
                  doc.rect(0, 0, pageWidth, pageHeight, "F");
                  doc.setTextColor(124, 58, 237);
                  doc.setFontSize(16);
                  doc.text("Chart Summary", margin, y);
                  y += 10;
                  doc.setTextColor(80, 80, 80);
                  doc.setFontSize(11);
                  const summaryLines = doc.splitTextToSize(reportData.summary, contentWidth);
                  doc.text(summaryLines, margin, y);
                  y += summaryLines.length * 6 + 15;

                  // Sections
                  reportData.sections.forEach((section, i) => {
                    checkPage(40);
                    // Section header
                    doc.setFillColor(245, 245, 255);
                    doc.roundedRect(margin - 2, y - 4, contentWidth + 4, 12, 2, 2, "F");
                    doc.setTextColor(124, 58, 237);
                    doc.setFontSize(13);
                    doc.text(`${i + 1}. ${section.title.replace(/^\d+\.\s*/, "")}`, margin, y + 4);
                    y += 16;

                    // Section content
                    doc.setTextColor(60, 60, 60);
                    doc.setFontSize(10);
                    const lines = doc.splitTextToSize(section.content, contentWidth);
                    lines.forEach((line) => {
                      checkPage(7);
                      doc.text(line, margin, y);
                      y += 5.5;
                    });
                    y += 10;
                  });

                  // Footer on last page
                  checkPage(20);
                  doc.setTextColor(150, 150, 150);
                  doc.setFontSize(8);
                  doc.text("Generated by BhavishAI | bhavishai.in | Powered by Swiss Ephemeris calculations.", pageWidth / 2, pageHeight - 10, { align: "center" });

                  // Save
                  doc.save(`${userData.name.replace(/\s+/g, "_")}_BhavishAI_Report.pdf`);
                }}
                className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-full text-sm font-medium transition-all glow-hover"
              >
                📥 Download PDF
              </button>
              <button
                onClick={() => window.print()}
                className="bg-surface-light hover:bg-border text-foreground px-6 py-2 rounded-full text-sm font-medium transition-all border border-border"
              >
                🖨️ Print Report
              </button>
              <a
                href="mailto:?subject=Check out BhavishAI - AI Astrology&body=I just got my Vedic astrology report from BhavishAI. Check it out: https://www.bhavishai.in"
                className="bg-surface-light hover:bg-border text-foreground px-6 py-2 rounded-full text-sm font-medium transition-all border border-border"
              >
                📨 Share with Friends
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
