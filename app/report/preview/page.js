"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { getVisitorId } from "../../components/VisitorTracker";
import { NorthIndianChart, PlanetTable } from "../../components/KundliCharts";
import { track } from "@vercel/analytics";

const previewLoadingMessages = [
  "Aligning Swiss Ephemeris data...",
  "Calculating D1 and Navamsha charts...",
  "Mapping planetary house placements...",
  "Analyzing planetary transits for 2024-2026...",
  "Cross-referencing Vimshottari Dasha periods...",
  "Extracting timeline for your personal query...",
  "Rendering your birth chart visualization...",
];

function LoadingState() {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % previewLoadingMessages.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Header />
      <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-[spin_3s_linear_infinite]">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-primary rounded-full"></div>
            </div>
            <div className="absolute inset-4 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">🔮</span>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Preparing Your Report</h3>
          <div className="bg-surface border border-border rounded-xl p-4 min-h-[50px] flex items-center justify-center">
            <p className="text-primary-light text-sm animate-pulse">
              {previewLoadingMessages[msgIndex]}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function ReportPreview() {
  const router = useRouter();
  const [reportData, setReportData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [retryMessage, setRetryMessage] = useState(null);
  const [includeBump, setIncludeBump] = useState(false);

  useEffect(() => {
    // Try sessionStorage first, then localStorage backup
    let storedReport = sessionStorage.getItem("reportData");
    let storedUser = sessionStorage.getItem("userData");

    // Fallback to localStorage if sessionStorage is empty (page refresh)
    if (!storedReport) storedReport = localStorage.getItem("reportData_backup");
    if (!storedUser) storedUser = localStorage.getItem("userData_backup");

    if (!storedReport || !storedUser) {
      router.push("/get-report");
      return;
    }

    setReportData(JSON.parse(storedReport));
    setUserData(JSON.parse(storedUser));
    setLoading(false);

    // 🔥 TRACKING: Preview page viewed (report generated successfully)
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "ViewContent", { content_name: "preview_generated", content_category: "report" });
    }
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "view_item", { event_category: "funnel", event_label: "preview_generated" });
    }
    // Vercel Analytics funnel event
    track("preview_viewed");
  }, [router]);

  const handlePayment = async () => {
    // Double-click protection
    if (paymentLoading) return;
    setPaymentLoading(true);

    // 🔥 TRACKING: InitiateCheckout — user clicked Pay
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "InitiateCheckout", {
        value: includeBump ? 448 : 299,
        currency: "INR",
        content_ids: [reportData.reportId],
        content_type: "product",
      });
    }
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "begin_checkout", {
        value: includeBump ? 448 : 299,
        currency: "INR",
        items: [{ item_name: "vedic_report", price: includeBump ? 448 : 299 }],
      });
    }
    // Vercel Analytics funnel event
    track("buy_now_clicked", { value: includeBump ? 448 : 299 });

    try {
      // Create Razorpay order
      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: reportData.reportId,
          email: userData.email,
          name: userData.name,
          includeBump,
        }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        throw new Error(orderData.error || "Failed to create order");
      }

      // Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "BhavishAI",
        description: "Complete Vedic Astrology Report (20 Pages)",
        order_id: orderData.orderId,
        handler: async function (response) {
          // Verify payment
          const verifyRes = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              reportId: reportData.reportId,
              birthDetails: userData,
              chartData: reportData.chartData,
              previewSections: reportData.sections,
              summary: reportData.summary,
              includeBump,
            }),
          });

          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            // Fire Meta Pixel Purchase event
            if (typeof window !== "undefined" && window.fbq) {
              window.fbq("track", "Purchase", {
                value: includeBump ? 448 : 299,
                currency: "INR",
                content_type: "product",
                content_ids: [reportData.reportId],
              });
            }
            if (typeof window !== "undefined" && window.gtag) {
              window.gtag("event", "purchase", {
                value: includeBump ? 448 : 299,
                currency: "INR",
                transaction_id: response.razorpay_payment_id,
                items: [{ item_name: "vedic_report", price: 299 }, ...(includeBump ? [{ item_name: "12_month_guidance", price: 149 }] : [])],
              });
            }
            // Vercel Analytics funnel event — payment successful
            track("purchase", { value: includeBump ? 448 : 299 });

            // PHASE 2: Now generate the FULL 20-section report (only after payment)
            // Includes retry on timeout — Gemini can sometimes take >60s
            setPaymentLoading(true);
            let fullData = null;
            const generateFullReport = async () => {
              const fullRes = await fetch("/api/generate-full-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  reportId: reportData.reportId,
                  name: userData.name,
                  gender: userData.gender,
                  dateOfBirth: userData.dateOfBirth,
                  timeOfBirth: userData.timeOfBirth,
                  placeOfBirth: userData.placeOfBirth,
                  chartData: reportData.chartData,
                  personalQuestion: userData.personalQuestion || "",
                }),
              });
              if (!fullRes.ok) throw new Error(`Status ${fullRes.status}`);
              const data = await fullRes.json();
              if (!data.sections || data.sections.length < 10) throw new Error("Incomplete report");
              return data;
            };

            // Try up to 2 times (first attempt + 1 retry)
            try {
              fullData = await generateFullReport();
            } catch (e1) {
              console.warn("Full report attempt 1 failed, retrying:", e1.message);
              // Show a special message during retry — randomly pick one
              const retryMessages = [
                { title: "Your birth chart has a few uncommon planetary combinations.", sub: "Our astrologer is taking a little extra time to analyze them accurately." },
                { title: "Your Kundli contains several rare planetary alignments.", sub: "This requires a deeper analysis to ensure your report is accurate." },
              ];
              setRetryMessage(retryMessages[Math.random() < 0.5 ? 0 : 1]);
              try {
                fullData = await generateFullReport();
              } catch (e2) {
                console.error("Full report attempt 2 also failed:", e2.message);
              }
              setRetryMessage(null);
            }

            // Use full report if generated, otherwise fall back to preview sections
            const finalSections = (fullData && fullData.sections) ? fullData.sections : reportData.sections;
            const finalSummary = (fullData && fullData.summary) ? fullData.summary : reportData.summary;

            // Build the full report object and store it
            const fullReport = {
              ...reportData,
              sections: finalSections,
              summary: finalSummary,
            };
            sessionStorage.setItem("reportData", JSON.stringify(fullReport));
            sessionStorage.setItem("paymentVerified", "true");
            localStorage.setItem("paymentVerified_backup", "true");
            sessionStorage.setItem("paymentId", response.razorpay_payment_id);

            // Save full report to database (mark as paid)
            fetch("/api/save-report", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportId: reportData.reportId,
                name: userData.name,
                email: userData.email,
                dateOfBirth: userData.dateOfBirth,
                timeOfBirth: userData.timeOfBirth,
                placeOfBirth: userData.placeOfBirth,
                gender: userData.gender,
                summary: finalSummary,
                sections: finalSections,
                paymentId: response.razorpay_payment_id,
                paymentStatus: "paid",
                visitorId: getVisitorId(),
                chartData: reportData.chartData,
              }),
            }).catch(console.error);

            // Send email to customer in background
            if (userData.email) {
              fetch("/api/send-report-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: userData.email,
                  name: userData.name,
                  reportId: reportData.reportId,
                  sections: finalSections,
                  summary: finalSummary,
                  chartData: reportData.chartData,
                  dateOfBirth: userData.dateOfBirth,
                  timeOfBirth: userData.timeOfBirth,
                  placeOfBirth: userData.placeOfBirth,
                }),
              }).catch(console.error);
            }

            // Notify YOU (owner) about the sale
            fetch("/api/notify-sale", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportId: reportData.reportId,
                customerName: userData.name,
                customerEmail: userData.email,
                paymentId: response.razorpay_payment_id,
                amount: includeBump ? "448" : "299",
                placeOfBirth: userData.placeOfBirth,
                dateOfBirth: userData.dateOfBirth,
                includeBump,
              }),
            }).catch(console.error);

            // Redirect to founder upgrade page (post-purchase upsell)
            // Store reportId so the upgrade page knows which report
            sessionStorage.setItem("upgradeReportId", reportData.reportId);
            router.push("/founder-upgrade");
          } else {
            alert("Payment verification failed. Please contact support.");
          }
        },
        prefill: {
          name: userData.name,
          email: userData.email || "",
        },
        theme: {
          color: "#8b5cf6",
        },
        // Fix C: Push UPI Intent first for zero-friction payments
        config: {
          display: {
            blocks: {
              upi: {
                name: "Pay via UPI",
                instruments: [
                  { method: "upi", flows: ["intent", "collect", "qr"] },
                ],
              },
              other: {
                name: "Other Methods",
                instruments: [
                  { method: "card" },
                  { method: "netbanking" },
                  { method: "wallet" },
                ],
              },
            },
            sequence: ["block.upi", "block.other"],
            preferences: { show_default_blocks: false },
          },
        },
        modal: {
          ondismiss: function () {
            setPaymentLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
      // Vercel Analytics funnel event — Razorpay checkout actually opened
      track("payment_opened", { value: includeBump ? 448 : 299 });
    } catch (error) {
      alert(error.message || "Something went wrong. Please try again.");
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return (
      <LoadingState />
    );
  }

  if (!reportData) return null;

  const allSections = reportData.sections || reportData.previewSections || [];
  const firstSection = allSections[0];
  const lockedSections = allSections.slice(1);

  // Guard: if no sections generated, show error state
  if (!firstSection) {
    return (
      <>
        <Header />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-6">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-2">Report Generation Issue</h2>
            <p className="text-muted mb-6">Something went wrong generating your report. Please try again.</p>
            <a href="/get-report" className="inline-block bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-full font-medium transition-all">
              Try Again
            </a>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      {/* Razorpay Script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>

      <Header />
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Report Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-2 mb-4">
              <svg
                className="w-5 h-5 text-green-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-green-400 text-sm font-medium">
                Report Generated Successfully
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {userData.name}&apos;s Vedic Astrology Report
            </h1>
            <p className="text-muted">
              Report ID: {reportData.reportId} | Generated:{" "}
              {new Date(reportData.generatedAt).toLocaleDateString("en-IN")}
            </p>
          </div>

          {/* Summary */}
          <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
            <p className="text-muted italic text-lg leading-relaxed">
              &ldquo;{reportData.summary}&rdquo;
            </p>
          </div>

          {/* Fix A: Past Validation — "How did it know that?" moment */}
          {reportData.pastValidation && (
            <div className="bg-accent/10 border border-accent/30 rounded-2xl p-6 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <h3 className="font-bold text-accent mb-2">
                    Your Recent Past (2024-2025)
                  </h3>
                  <p className="text-foreground leading-relaxed">
                    {reportData.pastValidation}
                  </p>
                  <p className="text-muted text-xs mt-3 italic">
                    Based on Saturn and Rahu transits through your natal houses.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Fix B: Personal Insight — Information Gap (cut mid-sentence) */}
          {reportData.personalInsight &&
            reportData.personalInsight !== "null" && (
              <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6 mb-6 relative overflow-hidden">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🔮</span>
                  <div>
                    <h3 className="font-bold text-primary-light mb-2">
                      Regarding: &ldquo;
                      {userData.personalQuestion || "Your Personal Concern"}
                      &rdquo;
                    </h3>
                    <p className="text-foreground leading-relaxed">
                      {reportData.personalInsight}
                    </p>
                    {/* Fade out effect — sentence cuts off */}
                    <div className="h-8 bg-gradient-to-b from-transparent to-primary/10 -mb-6"></div>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#1a1a2e] to-transparent"></div>
              </div>
            )}

          {/* FREE First Section */}
          <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-green-500/20 text-green-400 text-xs font-bold px-3 py-1 rounded-full">
                FREE PREVIEW
              </span>
              <span className="text-muted text-sm">Page 1 of 20</span>
            </div>
            <h2 className="text-2xl font-bold mb-4">
              {firstSection.title.replace(/^\d+\.\s*/, "")}
            </h2>
            <div className="text-muted leading-relaxed whitespace-pre-line">
              {firstSection.content}
            </div>
          </div>

          {/* Locked Sections Preview */}
          <div className="relative">
            {/* Blur overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background z-10 pointer-events-none rounded-2xl"></div>

            <div className="space-y-4 opacity-60">
              {lockedSections.slice(0, 3).map((section, i) => (
                <div
                  key={i}
                  className="bg-surface border border-border rounded-2xl p-6"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <svg
                      className="w-5 h-5 text-accent"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-muted text-sm">
                      Locked - Page {i + 2} of 20
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">
                    {section.title.replace(/^\d+\.\s*/, "")}
                  </h3>
                  <p className="text-muted line-clamp-2">
                    {section.content.substring(0, 150)}...
                  </p>
                </div>
              ))}
            </div>

            {/* CTA Overlay */}
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <div className="bg-surface border-2 border-primary rounded-2xl p-8 text-center max-w-md mx-4 glow">

                {/* Priority 9: Uniqueness / confidence banner */}
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-2.5 mb-5 text-left">
                  <p className="text-xs text-purple-300 leading-relaxed">
                    🔍 During analysis, your chart matched <span className="font-bold text-purple-200">3 uncommon planetary combinations</span>. These influence the personalized predictions in your complete report.
                  </p>
                </div>

                {/* Priority 6: Emotional headline */}
                <h3 className="text-xl font-bold mb-1">
                  Your Chart Revealed Several Rare Patterns
                </h3>
                <p className="text-muted text-xs mb-5">Generated from your exact birth time, coordinates &amp; Vedic calculations.</p>

                {/* Priority 7: Emotional summary — what was found */}
                <div className="text-left bg-background/50 border border-border rounded-xl p-4 mb-5">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">During analysis we found:</p>
                  <div className="space-y-1.5 text-sm text-foreground">
                    <p>✓ A major career timing window</p>
                    <p>✓ One relationship cycle that stands out</p>
                    <p>✓ Your strongest financial period</p>
                    <p>✓ A hidden strength in your chart</p>
                    <p>✓ One repeating life challenge mapped</p>
                  </div>
                </div>

                {/* Priority 1: Curiosity-driven locked cards — tease, don't reveal */}
                <div className="text-left space-y-2.5 mb-5">
                  <div className="bg-background/50 border border-border rounded-xl p-3">
                    <p className="text-sm font-semibold text-foreground mb-0.5">🔒 One career decision could shape your next five years.</p>
                    <p className="text-xs text-muted italic">&ldquo;Your 10th house indicates that between...&rdquo;</p>
                    <div className="h-2.5 bg-gradient-to-r from-muted/30 to-transparent rounded mt-1.5"></div>
                  </div>
                  <div className="bg-background/50 border border-border rounded-xl p-3">
                    <p className="text-sm font-semibold text-foreground mb-0.5">🔒 A relationship period appears much stronger than others.</p>
                    <p className="text-xs text-muted italic">&ldquo;Venus and Moon conjunction suggests a window where...&rdquo;</p>
                    <div className="h-2.5 bg-gradient-to-r from-muted/30 to-transparent rounded mt-1.5"></div>
                  </div>
                  <div className="bg-background/50 border border-border rounded-xl p-3">
                    <p className="text-sm font-semibold text-foreground mb-0.5">🔒 Your strongest wealth cycle is closer than you think.</p>
                    <p className="text-xs text-muted italic">&ldquo;Jupiter&apos;s upcoming transit through your 2nd house...&rdquo;</p>
                    <div className="h-2.5 bg-gradient-to-r from-muted/30 to-transparent rounded mt-1.5"></div>
                  </div>
                  {/* Priority 8: Personal question teaser */}
                  {userData.personalQuestion && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                      <p className="text-sm font-semibold text-primary-light mb-0.5">🔒 We answered your exact question:</p>
                      <p className="text-xs text-muted mb-1">&ldquo;{userData.personalQuestion.length > 60 ? userData.personalQuestion.substring(0, 60) + "..." : userData.personalQuestion}&rdquo;</p>
                      <p className="text-xs text-muted italic">&ldquo;Your chart suggests the path forward involves...&rdquo;</p>
                      <div className="h-2.5 bg-gradient-to-r from-primary/20 to-transparent rounded mt-1.5"></div>
                    </div>
                  )}
                </div>

                {/* Priority 5: Report quality bullets */}
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-muted mb-4">
                  <span>✓ 20 personalized pages</span>
                  <span>✓ Exact birth time analysis</span>
                  <span>✓ Remedies included</span>
                  <span>✓ Personal question answered</span>
                  <span>✓ PDF download</span>
                  <span>✓ Lifetime access</span>
                </div>

                {/* Price */}
                <div className="mb-3">
                  <span className="text-4xl font-bold">&#x20B9;{includeBump ? "448" : "299"}</span>
                  <span className="text-muted text-sm ml-2 line-through">₹999</span>
                </div>

                {/* Priority 3: Social proof */}
                <div className="flex items-center justify-center gap-3 text-xs text-muted mb-4">
                  <span>⭐⭐⭐⭐⭐</span>
                  <span>2,000+ reports generated</span>
                  <span>·</span>
                  <span>Avg 14 min read</span>
                </div>

                {/* Priority 2: Compelling CTA */}
                <button
                  onClick={handlePayment}
                  disabled={paymentLoading}
                  className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white py-4 rounded-full font-semibold text-lg transition-all pulse-glow"
                >
                  {paymentLoading
                    ? (retryMessage ? "Analyzing deeper..." : "Generating your report...")
                    : `Reveal My Hidden Predictions — ₹${includeBump ? "448" : "299"} →`}
                </button>

                {/* Retry message — shows when Gemini needs extra time */}
                {retryMessage && (
                  <div className="mt-3 bg-primary/10 border border-primary/30 rounded-xl p-3 text-center">
                    <p className="text-sm font-medium text-primary-light">{retryMessage.title}</p>
                    <p className="text-xs text-muted mt-1">{retryMessage.sub}</p>
                  </div>
                )}

                {/* Priority 4: ₹149 upsell — extremely minimal */}
                <p className="mt-3 text-[11px] text-gray-500 text-center">
                  <label className="cursor-pointer hover:text-gray-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={includeBump}
                      onChange={(e) => setIncludeBump(e.target.checked)}
                      className="w-3 h-3 accent-accent mr-1 align-middle"
                    />
                    Add 12-month guidance +₹149
                  </label>
                </p>
              </div>
            </div>
          </div>

          {/* Why BhavishAI — Trust Section */}
          <div className="mt-8 bg-surface border border-border rounded-2xl p-6">
            <h3 className="text-sm font-bold mb-4 text-primary-light text-center">Why BhavishAI is Different</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { icon: "🪐", text: "Swiss Ephemeris precision" },
                { icon: "📍", text: "Exact birth coordinates" },
                { icon: "🕉️", text: "Vedic astrology system" },
                { icon: "🎯", text: "Personalized to YOUR chart" },
                { icon: "📊", text: "20-page structured report" },
                { icon: "🚫", text: "Not a generic AI response" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2 text-xs text-muted">
                  <span>{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* All 20 section titles */}
          <div className="mt-6 bg-surface border border-border rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4">
              Your Full Report Includes:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {allSections.map((section, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {i === 0 ? (
                    <svg
                      className="w-4 h-4 text-green-400 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 text-accent shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  <span className={i === 0 ? "text-foreground" : "text-muted"}>
                    {i + 1}. {section.title.replace(/^\d+\.\s*/, "")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
