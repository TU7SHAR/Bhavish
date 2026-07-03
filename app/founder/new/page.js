"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

const loadingMessages = [
  "Mapping planetary positions at birth time...",
  "Calculating Rashi and Lagna...",
  "Analyzing Nakshatra and Dasha periods...",
  "Interpreting house lords and aspects...",
  "Generating your 20-page report...",
  "Almost done — finalizing predictions...",
];

export default function FounderNewReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    dateOfBirth: "",
    timeOfBirth: "",
    placeOfBirth: "",
    gender: "male",
    personalQuestion: "",
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const sanitize = (str) => str.replace(/<[^>]*>/g, "").trim();
    const clean = {
      ...formData,
      name: sanitize(formData.name),
      placeOfBirth: sanitize(formData.placeOfBirth),
      personalQuestion: sanitize(formData.personalQuestion || ""),
    };

    const dob = new Date(clean.dateOfBirth);
    if (dob > new Date() || dob.getFullYear() < 1920) {
      setError("Please enter a valid date of birth.");
      return;
    }

    setLoading(true);
    setError("");
    let i = 0;
    setLoadingMsg(loadingMessages[0]);
    const msgInterval = setInterval(() => {
      i = (i + 1) % loadingMessages.length;
      setLoadingMsg(loadingMessages[i]);
    }, 4000);

    try {
      const res = await fetch("/api/founder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clean),
      });
      const data = await res.json();
      clearInterval(msgInterval);
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      // Redirect to the new report
      router.push(`/dashboard/report/${data.reportId}`);
    } catch (err) {
      clearInterval(msgInterval);
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center min-h-screen">
          <div className="max-w-md mx-auto px-6 text-center">
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full border-4 border-accent/20 animate-[spin_6s_linear_infinite]">
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-accent rounded-full"></div>
              </div>
              <div className="absolute inset-6 rounded-full bg-accent/10 flex items-center justify-center">
                <span className="text-2xl">🎖️</span>
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Generating Your Founder Report</h2>
            <p className="text-muted text-sm mb-6">Free — thank you for being a Founding Member</p>
            <div className="bg-surface border border-border rounded-xl p-4 min-h-[56px] flex items-center justify-center">
              <p className="text-accent text-sm animate-pulse">{loadingMsg}</p>
            </div>
            <p className="text-muted text-xs mt-6">This takes 30-60 seconds. Please don&apos;t close this page.</p>
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
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-full px-4 py-2 mb-4">
              <span className="text-lg">🎖️</span>
              <span className="text-accent text-sm font-medium">Founding Member — Free Report</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Generate a New Report</h1>
            <p className="text-muted">As a Founding Member, this report is completely free. Enter the birth details below.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Full Name *</label>
                <input type="text" name="name" required placeholder="Enter full name" value={formData.name} onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Gender *</label>
                <div className="flex gap-4">
                  {["male", "female", "other"].map((g) => (
                    <label key={g} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="gender" value={g} checked={formData.gender === g} onChange={handleChange} className="accent-primary" />
                      <span className="text-sm text-muted capitalize">{g}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Date of Birth *</label>
                <input type="date" name="dateOfBirth" required max={new Date().toISOString().split("T")[0]} min="1920-01-01" value={formData.dateOfBirth} onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 h-12 [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Time of Birth *</label>
                <input type="time" name="timeOfBirth" required value={formData.timeOfBirth} onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 h-12 [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-primary" />
                <p className="text-muted text-xs mt-1">Check the birth certificate for exact time.</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Place of Birth *</label>
                <input type="text" name="placeOfBirth" required placeholder="e.g., Mumbai, Maharashtra, India" value={formData.placeOfBirth} onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Personal Question (Optional)</label>
                <textarea name="personalQuestion" rows={3} maxLength={500} placeholder="e.g., When will my career improve?" value={formData.personalQuestion} onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-accent hover:bg-accent-light disabled:opacity-50 text-black py-4 rounded-full font-semibold text-lg transition-all">
              Generate Free Report →
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
