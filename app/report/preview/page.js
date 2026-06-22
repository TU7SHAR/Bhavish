"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export default function ReportPreview() {
  const router = useRouter();
  const [reportData, setReportData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    const storedReport = sessionStorage.getItem("reportData");
    const storedUser = sessionStorage.getItem("userData");

    if (!storedReport || !storedUser) {
      router.push("/get-report");
      return;
    }

    setReportData(JSON.parse(storedReport));
    setUserData(JSON.parse(storedUser));
    setLoading(false);
  }, [router]);

  const handlePayment = async () => {
    setPaymentLoading(true);

    try {
      // Create Razorpay order
      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: reportData.reportId,
          email: userData.email,
          name: userData.name,
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
            }),
          });

          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            // Mark as paid in session
            sessionStorage.setItem("paymentVerified", "true");
            sessionStorage.setItem("paymentId", response.razorpay_payment_id);

            // Save report to database (mark as paid)
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
                summary: reportData.summary,
                sections: reportData.sections,
                paymentId: response.razorpay_payment_id,
                paymentStatus: "paid",
              }),
            }).catch(console.error);

            // Fire Meta Pixel Purchase event
            if (typeof window !== "undefined" && window.fbq) {
              window.fbq("track", "Purchase", {
                value: parseInt(process.env.NEXT_PUBLIC_REPORT_PRICE || "199"),
                currency: "INR",
                content_type: "product",
                content_ids: [reportData.reportId],
              });
            }

            // Send email in background (don't block redirect)
            if (userData.email) {
              fetch("/api/send-report-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: userData.email,
                  name: userData.name,
                  reportId: reportData.reportId,
                  sections: reportData.sections,
                  summary: reportData.summary,
                }),
              }).catch(console.error);
            }

            router.push("/report/full");
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
              upi: { name: "Pay via UPI", instruments: [{ method: "upi", flows: ["intent", "collect", "qr"] }] },
              other: { name: "Other Methods", instruments: [{ method: "card" }, { method: "netbanking" }, { method: "wallet" }] },
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
    } catch (error) {
      alert(error.message || "Something went wrong. Please try again.");
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted">Loading your report...</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!reportData) return null;

  const firstSection = reportData.sections[0];
  const lockedSections = reportData.sections.slice(1);

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
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              <span className="text-green-400 text-sm font-medium">Report Generated Successfully</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {userData.name}&apos;s Vedic Astrology Report
            </h1>
            <p className="text-muted">
              Report ID: {reportData.reportId} | Generated: {new Date(reportData.generatedAt).toLocaleDateString("en-IN")}
            </p>
          </div>

          {/* Summary */}
          <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
            <p className="text-muted italic text-lg leading-relaxed">&ldquo;{reportData.summary}&rdquo;</p>
          </div>

          {/* Fix A: Past Validation — "How did it know that?" moment */}
          {reportData.pastValidation && (
            <div className="bg-accent/10 border border-accent/30 rounded-2xl p-6 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <h3 className="font-bold text-accent mb-2">Your Recent Past (2024-2025)</h3>
                  <p className="text-foreground leading-relaxed">{reportData.pastValidation}</p>
                  <p className="text-muted text-xs mt-3 italic">Based on Saturn and Rahu transits through your natal houses.</p>
                </div>
              </div>
            </div>
          )}

          {/* Fix B: Personal Insight — Information Gap (cut mid-sentence) */}
          {reportData.personalInsight && reportData.personalInsight !== "null" && (
            <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6 mb-6 relative overflow-hidden">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔮</span>
                <div>
                  <h3 className="font-bold text-primary-light mb-2">Regarding: &ldquo;{userData.personalQuestion || "Your Personal Concern"}&rdquo;</h3>
                  <p className="text-foreground leading-relaxed">{reportData.personalInsight}</p>
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
              <span className="bg-green-500/20 text-green-400 text-xs font-bold px-3 py-1 rounded-full">FREE PREVIEW</span>
              <span className="text-muted text-sm">Page 1 of 20</span>
            </div>
            <h2 className="text-2xl font-bold mb-4">{firstSection.title.replace(/^\d+\.\s*/, "")}</h2>
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
                <div key={i} className="bg-surface border border-border rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                    </svg>
                    <span className="text-muted text-sm">Locked - Page {i + 2} of 20</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{section.title.replace(/^\d+\.\s*/, "")}</h3>
                  <p className="text-muted line-clamp-2">{section.content.substring(0, 150)}...</p>
                </div>
              ))}
            </div>

            {/* CTA Overlay */}
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <div className="bg-surface border-2 border-primary rounded-2xl p-8 text-center max-w-md mx-4 glow">
                <div className="text-4xl mb-4">🔒</div>
                <h3 className="text-2xl font-bold mb-2">Unlock Your Complete Report</h3>
                <p className="text-muted mb-6">
                  {userData.personalQuestion
                    ? `Get the full analysis of "${userData.personalQuestion.substring(0, 60)}${userData.personalQuestion.length > 60 ? '...' : ''}" plus 19 more sections including career, marriage, health, and remedies.`
                    : "19 more sections including career, marriage, health, doshas, remedies, and 2026-2027 predictions."
                  }
                </p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">&#x20B9;199</span>
                  <span className="text-muted ml-2">one-time</span>
                </div>
                <button
                  onClick={handlePayment}
                  disabled={paymentLoading}
                  className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white py-4 rounded-full font-semibold text-lg transition-all pulse-glow"
                >
                  {paymentLoading ? "Processing..." : "Unlock Full Report \u2192"}
                </button>
                <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted">
                  <span>🔒 Secure UPI/Card</span>
                  <span>⚡ Instant access</span>
                  <span>📧 Email copy</span>
                </div>
              </div>
            </div>
          </div>

          {/* All 20 section titles */}
          <div className="mt-12 bg-surface border border-border rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4">Your Full Report Includes:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {reportData.sections.map((section, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {i === 0 ? (
                    <svg className="w-4 h-4 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-accent shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
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
