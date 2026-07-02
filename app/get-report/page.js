"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { getAttribution } from "../components/AttributionCapture";

const loadingMessages = [
  "Mapping planetary positions at your birth time...",
  "Calculating Rashi and Lagna from coordinates...",
  "Analyzing Nakshatra and Pada placement...",
  "Evaluating Vimshottari Mahadasha periods...",
  "Checking for Manglik and Kaal Sarp Dosha...",
  "Interpreting house lords and aspects...",
  "Generating career and finance predictions...",
  "Analyzing marriage and compatibility yogas...",
  "Computing lucky numbers, colors, and gems...",
  "Preparing your personalized 20-page report...",
  "Almost done — finalizing predictions...",
];

export default function GetReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    dateOfBirth: "",
    timeOfBirth: "",
    placeOfBirth: "",
    gender: "male",
    email: "",
    personalQuestion: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Double-click protection
    if (loading) return;
    
    // Input sanitization — strip HTML tags
    const sanitize = (str) => str.replace(/<[^>]*>/g, "").trim();
    const cleanData = {
      ...formData,
      name: sanitize(formData.name),
      placeOfBirth: sanitize(formData.placeOfBirth),
      personalQuestion: sanitize(formData.personalQuestion || ""),
    };

    // Validate date is not in future and not too old
    const dob = new Date(cleanData.dateOfBirth);
    const now = new Date();
    if (dob > now || dob.getFullYear() < 1920) {
      setError("Please enter a valid date of birth.");
      return;
    }

    // 🔥 TRACKING: Form submitted — user committed birth details
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "Lead", { content_name: "birth_details_submitted" });
    }
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "generate_lead", { event_category: "funnel", event_label: "birth_details_submitted" });
    }

    setLoading(true);
    setError("");
    setLoadingProgress(0);

    // Start cycling through loading messages
    let msgIndex = 0;
    setLoadingMsg(loadingMessages[0]);
    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % loadingMessages.length;
      setLoadingMsg(loadingMessages[msgIndex]);
    }, 3500);

    // Simulate progress bar
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 90) return 90; // Don't go past 90 until actually done
        return prev + Math.random() * 8;
      });
    }, 2000);

    try {
      const res = await fetch("/api/generate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      clearInterval(msgInterval);
      clearInterval(progressInterval);

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      setLoadingProgress(100);
      setLoadingMsg("Report ready! Redirecting...");

      // Store report data in sessionStorage AND localStorage (backup)
      sessionStorage.setItem("reportData", JSON.stringify(data));
      sessionStorage.setItem("userData", JSON.stringify(formData));
      localStorage.setItem("reportData_backup", JSON.stringify(data));
      localStorage.setItem("userData_backup", JSON.stringify(formData));

      // Save report to DB as "unpaid" (captures email for future reference)
      // Non-blocking — failure here must NOT break the flow
      fetch("/api/save-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: data.reportId,
          name: formData.name,
          email: formData.email,
          dateOfBirth: formData.dateOfBirth,
          timeOfBirth: formData.timeOfBirth,
          placeOfBirth: formData.placeOfBirth,
          gender: formData.gender,
          summary: data.summary,
          sections: data.sections || data.previewSections || [],
          paymentStatus: "unpaid",
          attribution: getAttribution(),
          personalQuestion: formData.personalQuestion || "",
          city: data.city || "",
        }),
      })
        .then(() => {
          // OPTION B: After the lead row exists, pre-generate all 10 nurture
          // emails in ONE Gemini call and store them as drafts. The cron later
          // just reads + sends these (no AI at send time). Only worth doing
          // when we actually captured an email. Fully non-blocking.
          if (formData.email && formData.email.trim()) {
            fetch("/api/generate-email-sequence", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportId: data.reportId,
                name: formData.name,
                summary: data.summary,
                sections: data.sections || data.previewSections || [],
                dateOfBirth: formData.dateOfBirth,
                placeOfBirth: formData.placeOfBirth,
                personalQuestion: formData.personalQuestion || "",
              }),
            }).catch(console.error);
          }
        })
        .catch(console.error);

      // Small delay to show 100% before redirect
      setTimeout(() => {
        router.push("/report/preview");
      }, 800);
    } catch (err) {
      clearInterval(msgInterval);
      clearInterval(progressInterval);
      setError(err.message);
      setLoading(false);
    }
  };

  // Full-page loading screen
  if (loading) {
    return (
      <>
        <Header />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center min-h-screen">
          <div className="max-w-md mx-auto px-6 text-center">
            {/* Animated cosmic circle */}
            <div className="relative w-32 h-32 mx-auto mb-8">
              {/* Outer rotating ring */}
              <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-[spin_8s_linear_infinite]">
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full"></div>
              </div>
              {/* Middle rotating ring */}
              <div className="absolute inset-3 rounded-full border-4 border-accent/20 animate-[spin_5s_linear_infinite_reverse]">
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-accent rounded-full"></div>
              </div>
              {/* Inner pulsing core */}
              <div className="absolute inset-8 rounded-full bg-primary/20 animate-pulse flex items-center justify-center">
                <span className="text-3xl">🔮</span>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold mb-2">Generating Your Report</h2>
            <p className="text-muted text-sm mb-6">
              Our AI is analyzing planetary positions for <span className="text-foreground font-medium">{formData.name}</span>
            </p>

            {/* Progress bar */}
            <div className="w-full bg-surface border border-border rounded-full h-3 mb-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(loadingProgress, 100)}%` }}
              ></div>
            </div>

            {/* Progress percentage */}
            <p className="text-sm text-muted mb-4">{Math.round(Math.min(loadingProgress, 100))}% complete</p>

            {/* Rotating messages */}
            <div className="bg-surface border border-border rounded-xl p-4 min-h-[60px] flex items-center justify-center">
              <p className="text-primary-light text-sm animate-pulse">
                {loadingMsg}
              </p>
            </div>

            {/* Time estimate */}
            <p className="text-muted text-xs mt-6">
              This usually takes 30-60 seconds. Please don&apos;t close this page.
            </p>
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
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Enter Your Birth Details
            </h1>
            <p className="text-muted text-lg">
              We need your exact birth information to generate an accurate Vedic astrology report.
              The more precise your birth time, the better your report.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-6">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Gender *
                </label>
                <div className="flex gap-4">
                  {["male", "female", "other"].map((g) => (
                    <label key={g} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value={g}
                        checked={formData.gender === g}
                        onChange={handleChange}
                        className="w-4 h-4 text-primary accent-primary"
                      />
                      <span className="text-sm text-muted capitalize">{g}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date of Birth */}
              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-foreground mb-2">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  id="dateOfBirth"
                  name="dateOfBirth"
                  required
                  max={new Date().toISOString().split("T")[0]}
                  min="1920-01-01"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 h-12 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all [color-scheme:dark] appearance-none"
                />
              </div>

              {/* Time of Birth */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Time of Birth *
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.timeOfBirth ? (parseInt(formData.timeOfBirth.split(":")[0]) % 12 || 12).toString() : ""}
                    onChange={(e) => {
                      const h = parseInt(e.target.value);
                      const currentMin = formData.timeOfBirth ? formData.timeOfBirth.split(":")[1]?.substring(0,2) || "00" : "00";
                      const currentPeriod = formData.timeOfBirth && parseInt(formData.timeOfBirth.split(":")[0]) >= 12 ? "PM" : "AM";
                      const h24 = currentPeriod === "PM" ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
                      setFormData({ ...formData, timeOfBirth: `${h24.toString().padStart(2,"0")}:${currentMin}` });
                    }}
                    required
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-3 h-12 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all [color-scheme:dark]"
                  >
                    <option value="" disabled>Hour</option>
                    {[12,1,2,3,4,5,6,7,8,9,10,11].map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select
                    value={formData.timeOfBirth ? formData.timeOfBirth.split(":")[1]?.substring(0,2) || "" : ""}
                    onChange={(e) => {
                      const currentHour = formData.timeOfBirth ? formData.timeOfBirth.split(":")[0] : "00";
                      setFormData({ ...formData, timeOfBirth: `${currentHour}:${e.target.value}` });
                    }}
                    required
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-3 h-12 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all [color-scheme:dark]"
                  >
                    <option value="" disabled>Min</option>
                    {Array.from({length: 60}, (_, i) => <option key={i} value={i.toString().padStart(2,"0")}>{i.toString().padStart(2,"0")}</option>)}
                  </select>
                  <select
                    value={formData.timeOfBirth && parseInt(formData.timeOfBirth.split(":")[0]) >= 12 ? "PM" : formData.timeOfBirth ? "AM" : ""}
                    onChange={(e) => {
                      if (!formData.timeOfBirth) {
                        setFormData({ ...formData, timeOfBirth: e.target.value === "PM" ? "12:00" : "00:00" });
                        return;
                      }
                      let h = parseInt(formData.timeOfBirth.split(":")[0]);
                      const min = formData.timeOfBirth.split(":")[1]?.substring(0,2) || "00";
                      if (e.target.value === "PM" && h < 12) h += 12;
                      if (e.target.value === "AM" && h >= 12) h -= 12;
                      setFormData({ ...formData, timeOfBirth: `${h.toString().padStart(2,"0")}:${min}` });
                    }}
                    required
                    className="w-20 bg-background border border-border rounded-xl px-2 py-3 h-12 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all [color-scheme:dark]"
                  >
                    <option value="" disabled>AM/PM</option>
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
                <p className="text-muted text-xs mt-1">
                  Check your birth certificate for exact time. Even a few minutes matter!
                </p>
              </div>

              {/* Place of Birth */}
              <div>
                <label htmlFor="placeOfBirth" className="block text-sm font-medium text-foreground mb-2">
                  Place of Birth *
                </label>
                <input
                  type="text"
                  id="placeOfBirth"
                  name="placeOfBirth"
                  required
                  placeholder="e.g., Mumbai, Maharashtra, India"
                  value={formData.placeOfBirth}
                  onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                  Email Address (for report delivery)
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="your@email.com (optional)"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
                <p className="text-muted text-xs mt-1">
                  Optional. We&apos;ll email a backup copy of your report after purchase.
                </p>
              </div>

              {/* Personal Question */}
              <div>
                <label htmlFor="personalQuestion" className="block text-sm font-medium text-foreground mb-2">
                  What&apos;s your biggest life concern right now? (Optional)
                </label>
                <textarea
                  id="personalQuestion"
                  name="personalQuestion"
                  rows={3}
                  placeholder="e.g., Will my career improve in 2027? When will I get married? Should I start this business? Is going abroad in my destiny?"
                  value={formData.personalQuestion}
                  onChange={handleChange}
                  maxLength={500}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                />
                <p className="text-muted text-xs mt-1">
                  Optional. If provided, your report will include a dedicated section analyzing this specific concern using your birth chart.
                </p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-full font-semibold text-lg transition-all glow-hover flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating Your Report...
                </>
              ) : (
                "Generate My Free Preview \u2192"
              )}
            </button>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                Data encrypted
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                No payment for preview
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                Ready in 60 seconds
              </span>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
