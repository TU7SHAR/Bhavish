"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { getVisitorId } from "../../components/VisitorTracker";
import { track } from "@vercel/analytics";
import { resolvePlan } from "../../../lib/plans.js";

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
  // Three-tier selector. Essential is the DEFAULT (₹299 ad promise); Premium is
  // highlighted as Most Popular but NOT auto-selected (avoids bait-and-switch).
  const [selectedPlan, setSelectedPlan] = useState("essential");
  const [includeGuidance, setIncludeGuidance] = useState(false); // ₹149 add-on (Essential only)
  const [paymentError, setPaymentError] = useState(null);

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
    setPaymentError(null); // clear any previous failure before a fresh attempt

    // Server is authoritative on price; we mirror it here only for tracking.
    const planId = selectedPlan;
    const guidanceOn = planId === "essential" ? includeGuidance : true;
    const plan = resolvePlan(planId, { includeGuidance });
    const price = plan?.price || 299;
    const isMaster = planId === "master";

    // 🔥 TRACKING: InitiateCheckout — user clicked Pay
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "InitiateCheckout", {
        value: price,
        currency: "INR",
        content_ids: [reportData.reportId],
        content_type: "product",
        content_name: planId,
      });
    }
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "begin_checkout", {
        value: price,
        currency: "INR",
        items: [{ item_name: `vedic_report_${planId}`, price }],
      });
    }
    // Vercel Analytics funnel event
    track("buy_now_clicked", { value: price, plan: planId });

    try {
      // Create Razorpay order
      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: reportData.reportId,
          email: userData.email,
          name: userData.name,
          planId,
          includeGuidance,
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
        description: `Vedic Astrology Report — ${planId.charAt(0).toUpperCase() + planId.slice(1)}`,
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
              planId,
              includeGuidance,
            }),
          });

          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            // Fire Meta Pixel Purchase event
            if (typeof window !== "undefined" && window.fbq) {
              window.fbq("track", "Purchase", {
                value: price,
                currency: "INR",
                content_type: "product",
                content_ids: [reportData.reportId],
                content_name: planId,
              });
            }
            if (typeof window !== "undefined" && window.gtag) {
              window.gtag("event", "purchase", {
                value: price,
                currency: "INR",
                transaction_id: response.razorpay_payment_id,
                items: [{ item_name: `vedic_report_${planId}`, price }],
              });
            }
            // Vercel Analytics funnel event — payment successful
            track("purchase", { value: price, plan: planId });

            // PHASE 2: Now generate the FULL 20-section report (only after payment)
            // Includes retry on timeout — Gemini can sometimes take >60s
            setPaymentLoading(true);
            let fullData = null;
            const generateFullReport = async () => {
              const fullRes = await fetch("/api/generate-full-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // SECURITY: Only send reportId. The server loads all birth data,
                // chart data, and plan tier from the database (single source of
                // truth). This prevents wrong reports from stale localStorage.
                body: JSON.stringify({ reportId: reportData.reportId }),
              });
              if (!fullRes.ok) {
                const errData = await fullRes.json().catch(() => ({}));
                // 409 = report is already being generated (webhook beat us)
                if (fullRes.status === 409) return errData;
                throw new Error(errData.error || `Status ${fullRes.status}`);
              }
              const data = await fullRes.json();
              const minOk = planId === "essential" ? 8 : 10;
              if (!data.sections || data.sections.length < minOk) throw new Error("Incomplete report");
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

            // ── QUALITY LOCK ── never treat an incomplete report as delivered.
            // Tier-aware: Essential is ~11 sections, Premium/Master ~22. Guidance
            // section required whenever guidance was purchased.
            const REQUIRED_SECTIONS = planId === "essential" ? 9 : 18;
            const hasGuidance = fullData?.sections?.some((s) => /guidance pack|12-month/i.test(s.title || ""));
            const isComplete = Boolean(
              fullData &&
              Array.isArray(fullData.sections) &&
              fullData.sections.length >= REQUIRED_SECTIONS &&
              fullData.summary &&
              (!guidanceOn || hasGuidance)
            );

            // Master: kick off the concern-specific deep-dive as its OWN job.
            // It appends to the report server-side; /report/full will poll for it.
            if (isMaster && isComplete) {
              fetch("/api/generate-master-deep-dive", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reportId: reportData.reportId }),
              }).catch(console.error);
              sessionStorage.setItem("masterDeepDivePending", "true");
            }

            // Never pass off the 2-section preview as the full report.
            const finalSections = isComplete ? fullData.sections : reportData.sections;
            const finalSummary = isComplete ? fullData.summary : reportData.summary;

            sessionStorage.setItem("reportData", JSON.stringify({ ...reportData, sections: finalSections, summary: finalSummary }));
            sessionStorage.setItem("paymentVerified", "true");
            localStorage.setItem("paymentVerified_backup", "true");
            sessionStorage.setItem("paymentId", response.razorpay_payment_id);
            // Flag so /report/full shows an honest "being prepared" screen instead of a partial report
            if (isComplete) sessionStorage.removeItem("reportPending");
            else sessionStorage.setItem("reportPending", "true");

            // Always persist the payment; record report_status so admin knows delivery state.
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
                reportStatus: isComplete ? "completed" : "failed",
                visitorId: getVisitorId(),
                chartData: reportData.chartData,
                planId,
                includeGuidance,
              }),
            }).catch(console.error);

            // Email the customer ONLY if the report passed the quality check.
            if (isComplete && userData.email) {
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
                  includeBump: guidanceOn,
                }),
              }).catch(console.error);
            }

            // Notify owner about the sale — flag failures so YOU can regenerate
            // and resend before the customer even notices.
            fetch("/api/notify-sale", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportId: reportData.reportId,
                customerName: userData.name,
                customerEmail: userData.email,
                paymentId: response.razorpay_payment_id,
                amount: String(price),
                planTier: planId,
                placeOfBirth: userData.placeOfBirth,
                dateOfBirth: userData.dateOfBirth,
                includeBump: guidanceOn,
                reportComplete: isComplete,
              }),
            }).catch(console.error);

            // Go straight to the full report. The Founder upsell has been retired
            // for new buyers (existing Founder members are grandfathered).
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

      // Handle payment failures (bank declines, wrong OTP, gateway timeouts).
      // Razorpay does NOT call the success handler here — the modal closes and
      // this fires instead. We show a friendly, non-alarming retry nudge and
      // push the user toward UPI (far higher success rate than netbanking/cards).
      rzp.on("payment.failed", function (resp) {
        const err = (resp && resp.error) || {};
        const source = err.source || "";
        const step = err.step || "";
        const reason = err.reason || "";

        let title = "Payment didn't go through";
        let detail =
          "No money was deducted. If any amount was debited, it is automatically refunded within 4-5 business days.";

        if (source === "bank" || step === "payment_authorization") {
          title = "Your bank declined the payment";
          detail =
            "This is a temporary bank-side issue, not a problem with your account. Paying via UPI usually works instantly. No money was deducted.";
        } else if (source === "customer") {
          title = "Payment was cancelled";
          detail =
            "No problem — you can try again whenever you're ready. UPI is the fastest way to pay.";
        }

        setPaymentError({ title, detail });
        setPaymentLoading(false);

        // 🔥 TRACKING: a failed attempt is your HOTTEST lead — they opened their wallet.
        if (typeof window !== "undefined" && window.fbq) {
          window.fbq("trackCustom", "PaymentFailed", {
            value: price,
            currency: "INR",
            reason: reason || source || "unknown",
          });
        }
        if (typeof window !== "undefined" && window.gtag) {
          window.gtag("event", "payment_failed", {
            event_category: "funnel",
            event_label: reason || source || "unknown",
          });
        }
        track("payment_failed", { source: source || "unknown" });
      });

      rzp.open();
      // Vercel Analytics funnel event — Razorpay checkout actually opened
      track("payment_opened", { value: price, plan: planId });
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

  // Categorize the user's question so the paywall teaser matches their intent.
  // Pure keyword match — instant, no AI, no cost. Order matters (most specific first).
  const categorizeQuestion = (q) => {
    if (!q) return "general";
    const t = q.toLowerCase();
    const has = (arr) => arr.some((w) => t.includes(w));
    if (has(["marriage", "married", "shadi", "spouse", "wife", "husband", "rishta", "engaged", "vivah"])) return "marriage";
    if (has(["love", "relationship", "girlfriend", "boyfriend", " ex", "partner", "crush", "breakup", "soulmate", "affair"])) return "love";
    if (has(["exam", "upsc", "cfa", "study", "college", "degree", "master", "admission", "cma", "neet", "gate"])) return "education";
    if (has(["job", "career", "promot", "business", "work", "interview", "freelance", "salary", "office", "startup"])) return "career";
    if (has(["money", "financ", "wealth", "fund", "debt", "loan", "income", "property"])) return "money";
    return "general";
  };

  const questionCategory = categorizeQuestion(userData.personalQuestion);

  const CATEGORY_CONTENT = {
    career: {
      label: "Career",
      cards: [
        { t: "Whether this is the right time to make your move", s: "Your 10th house and current dasha indicate that between..." },
        { t: "Your strongest career window in the coming period", s: "The transit through your career houses points to a phase where..." },
        { t: "Risks and delays to avoid before you decide", s: "One planetary influence signals caution around..." },
      ],
    },
    love: {
      label: "Love",
      cards: [
        { t: "Whether this connection has real future potential", s: "Venus and the 5th/7th house pattern suggests that..." },
        { t: "The strongest period for progress in this relationship", s: "An upcoming transit opens a window where..." },
        { t: "What may cause distance, delay, or misunderstanding", s: "One influence in your chart points to friction around..." },
      ],
    },
    marriage: {
      label: "Marriage",
      cards: [
        { t: "The timing your chart favours for marriage", s: "Your 7th house and dasha sequence indicate a window around..." },
        { t: "Love or arranged — what your chart leans toward", s: "The placement of Venus and the 7th lord suggests..." },
        { t: "What may cause delay before it happens", s: "One planetary influence points to a hurdle around..." },
      ],
    },
    money: {
      label: "Money",
      cards: [
        { t: "Your strongest financial growth periods", s: "Jupiter's movement through your wealth houses indicates..." },
        { t: "When money delays ease and recovery begins", s: "Your current dasha suggests a turning point around..." },
        { t: "Risk periods to protect your finances", s: "One transit signals caution with money around..." },
      ],
    },
    education: {
      label: "Exam",
      cards: [
        { t: "Whether your chart supports success this attempt", s: "Your 5th house and Mercury/Jupiter influence indicate..." },
        { t: "The period that favours your results most", s: "An upcoming transit points to a strong window around..." },
        { t: "What to watch for that could cause a setback", s: "One planetary influence signals caution around..." },
      ],
    },
    general: {
      label: "",
      cards: [
        { t: "One career decision could shape your next five years.", s: "Your 10th house indicates that between..." },
        { t: "A relationship period appears much stronger than others.", s: "Venus and Moon conjunction suggests a window where..." },
        { t: "Your strongest wealth cycle is closer than you think.", s: "Jupiter's upcoming transit through your 2nd house..." },
      ],
    },
  };

  const catContent = CATEGORY_CONTENT[questionCategory];
  const answerHeadline = catContent.label ? `Your ${catContent.label} Answer Is Ready` : "Your Full Answer Is Ready";

  // Three-tier selector data. Sell outcomes, not raw section counts.
  const focusLabel = catContent.label || "life";
  const TIERS = [
    {
      id: "essential",
      name: "Essential",
      price: 299,
      tagline: "Your key answer, clearly explained",
      points: ["10 core life sections", "Direct answer to your question", "Remedies & lucky factors"],
    },
    {
      id: "premium",
      name: "Premium",
      price: 499,
      badge: "MOST POPULAR",
      tagline: "The complete analysis + a full year of guidance",
      points: ["20 in-depth sections", "Direct answer to your question", "12-month month-by-month guidance"],
    },
    {
      id: "master",
      name: "Master",
      price: 999,
      badge: "MOST COMPLETE",
      tagline: `Everything, plus a specialized ${focusLabel.toLowerCase()} deep-dive`,
      points: [
        "Everything in Premium",
        `7-part ${focusLabel.toLowerCase()} deep-dive on your concern`,
        "24-month personalized roadmap",
      ],
    },
  ];
  const selectedResolved = resolvePlan(selectedPlan, { includeGuidance });
  const displayPrice = selectedResolved?.price || 299;

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
              <span className="text-muted text-sm">Sample section</span>
            </div>
            <h2 className="text-2xl font-bold mb-4">
              {firstSection.title.replace(/^\d+\.\s*/, "")}
            </h2>
            <div className="text-muted leading-relaxed whitespace-pre-line">
              {firstSection.content}
            </div>
          </div>

          {/* Locked Sections Preview */}
          <div className="relative overflow-hidden min-h-[600px]">
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
                      Locked section
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
            <div className="absolute inset-0 z-20 flex items-start justify-center pt-8">
              <div className="bg-surface border-2 border-primary rounded-2xl p-8 text-center max-w-md mx-4 glow">

                {/* Priority 9: Personalization banner — references their chart */}
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-2.5 mb-5 text-left">
                  <p className="text-xs text-purple-300 leading-relaxed">
                    ✓ Your chart has been fully analyzed. Your <span className="font-bold text-purple-200">{reportData.chartData?.dashaTimeline?.currentMahadasha || "current"} Mahadasha</span> period and its influence on your question is covered in your complete report.
                  </p>
                </div>

                {/* Priority 6: Emotional headline — answer-focused, matches their question topic */}
                <h3 className="text-xl font-bold mb-1">
                  {answerHeadline}
                </h3>
                <p className="text-muted text-xs mb-5">Analyzed from your exact birth time, coordinates &amp; Vedic calculations.</p>

                {/* Priority 7: What the user will GET — outcome-focused, not feature-focused */}
                <div className="text-left bg-background/50 border border-border rounded-xl p-4 mb-5">
                  {userData.personalQuestion && (
                    <div className="mb-3 pb-3 border-b border-border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Your question:</p>
                      <p className="text-sm text-primary-light font-medium">&ldquo;{userData.personalQuestion.length > 80 ? userData.personalQuestion.substring(0, 80) + "..." : userData.personalQuestion}&rdquo;</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Inside your complete report:</p>
                  <div className="space-y-1.5 text-sm text-foreground">
                    <p>✓ Direct answer to your question with timing</p>
                    <p>✓ Best period to take action</p>
                    <p>✓ What may delay or block your result</p>
                    <p>✓ Your current planetary period and what it means</p>
                    <p>✓ Personalized remedies and next steps</p>
                    <p className="text-muted/70">Depth depends on the plan you choose below.</p>
                  </div>
                </div>

                {/* Priority 1: Curiosity-driven locked cards — matched to the user's question topic */}
                <div className="text-left space-y-2.5 mb-5">
                  {catContent.cards.map((card, i) => (
                    <div key={i} className="bg-background/50 border border-border rounded-xl p-3">
                      <p className="text-sm font-semibold text-foreground mb-0.5">🔒 {card.t}</p>
                      <p className="text-xs text-muted italic">&ldquo;{card.s}&rdquo;</p>
                      <div className="h-2.5 bg-gradient-to-r from-muted/30 to-transparent rounded mt-1.5"></div>
                    </div>
                  ))}
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
                  <span>✓ Personalized to your chart</span>
                  <span>✓ Exact birth time analysis</span>
                  <span>✓ Remedies included</span>
                  <span>✓ Personal question answered</span>
                  <span>✓ PDF download</span>
                  <span>✓ Lifetime access</span>
                </div>

                {/* Priority 3: Social proof */}
                <div className="flex items-center justify-center gap-3 text-xs text-muted mb-4">
                  <span>⭐⭐⭐⭐⭐</span>
                  <span>2,000+ reports generated</span>
                </div>

                {/* ── THREE-TIER SELECTOR ── Essential default, Premium highlighted */}
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2 text-left">Choose your report</p>
                <div className="space-y-2.5 mb-4">
                  {TIERS.map((t) => {
                    const active = selectedPlan === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedPlan(t.id)}
                        className={`relative w-full text-left rounded-xl p-3.5 border-2 transition-all ${
                          active
                            ? "border-primary bg-primary/10"
                            : t.badge === "MOST POPULAR"
                              ? "border-primary/40 bg-background/50 hover:border-primary/70"
                              : "border-border bg-background/50 hover:border-primary/40"
                        }`}
                      >
                        {t.badge && (
                          <span className={`absolute -top-2 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            t.badge === "MOST POPULAR" ? "bg-primary text-white" : "bg-accent text-black"
                          }`}>
                            {t.badge}
                          </span>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${active ? "border-primary" : "border-muted"}`}>
                              {active && <span className="w-2 h-2 rounded-full bg-primary" />}
                            </span>
                            <span className="font-bold text-foreground">{t.name}</span>
                          </div>
                          <span className="font-bold text-foreground">&#x20B9;{t.price}</span>
                        </div>
                        <p className="text-xs text-muted mt-1 ml-6">{t.tagline}</p>
                        {active && (
                          <ul className="mt-2 ml-6 space-y-1">
                            {t.points.map((p) => (
                              <li key={p} className="text-[11px] text-foreground flex items-start gap-1.5">
                                <span className="text-green-400">✓</span><span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Essential-only: ₹149 guidance add-on + the "₹51 more" Premium nudge */}
                {selectedPlan === "essential" && (
                  <div className="mb-4">
                    <label className="block text-left bg-background/50 border border-border rounded-xl p-3 cursor-pointer hover:border-accent/40 transition-colors">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={includeGuidance}
                          onChange={(e) => setIncludeGuidance(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-accent shrink-0"
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">Add 12-Month Guidance Pack — ₹149</p>
                          <p className="text-xs text-muted mt-0.5">Month-by-month guidance for career, money, relationships & health for the next 12 months.</p>
                        </div>
                      </div>
                    </label>

                    {/* The ₹51 decoy nudge — only when the Essential+Guidance total (₹448) is close to Premium (₹499) */}
                    {includeGuidance && (
                      <div className="mt-2 bg-primary/10 border border-primary/30 rounded-xl p-3 text-left">
                        <p className="text-sm font-semibold text-primary-light">⭐ Premium is only ₹51 more</p>
                        <p className="text-xs text-muted mt-0.5 mb-2">Get the complete 20-section analysis <em>plus</em> your 12-month guidance for ₹499.</p>
                        <button
                          type="button"
                          onClick={() => setSelectedPlan("premium")}
                          className="w-full bg-primary/20 hover:bg-primary/30 text-primary-light py-2 rounded-full text-xs font-semibold transition-all"
                        >
                          Upgrade to Premium — ₹499 →
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Compelling CTA — price reflects the selected plan */}
                <button
                  onClick={handlePayment}
                  disabled={paymentLoading}
                  className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white py-4 rounded-full font-semibold text-lg transition-all pulse-glow"
                >
                  {paymentLoading
                    ? (retryMessage ? "Analyzing deeper..." : "Generating your report...")
                    : `Unlock My Report — ₹${displayPrice} →`}
                </button>

                {/* Retry message — shows when Gemini needs extra time */}
                {retryMessage && (
                  <div className="mt-3 bg-primary/10 border border-primary/30 rounded-xl p-3 text-center">
                    <p className="text-sm font-medium text-primary-light">{retryMessage.title}</p>
                    <p className="text-xs text-muted mt-1">{retryMessage.sub}</p>
                  </div>
                )}

                {/* Payment failed — friendly, non-alarming retry nudge (pushes UPI) */}
                {paymentError && !paymentLoading && (
                  <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                    <p className="text-sm font-semibold text-red-300">⚠️ {paymentError.title}</p>
                    <p className="text-xs text-muted mt-1 leading-relaxed">{paymentError.detail}</p>
                    <button
                      onClick={handlePayment}
                      disabled={paymentLoading}
                      className="mt-3 w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white py-2.5 rounded-full font-semibold text-sm transition-all"
                    >
                      Try Again — Pay via UPI →
                    </button>
                  </div>
                )}

                {/* Trust line */}
                <p className="mt-2 text-[10px] text-gray-600 text-center">
                  Secure Razorpay payment · Instant access · Sent to your email
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
                { icon: "📊", text: "Structured, in-depth report" },
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
