"use client";

import { useState } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics";

// Interactive Manglik (Mangal Dosha) calculator. Posts to /api/tools/manglik,
// which runs the same deterministic engine as the paid report. The result
// funnels the visitor into the full ₹299 report via /get-report.
export default function ManglikCalculator() {
  const [form, setForm] = useState({ dateOfBirth: "", timeOfBirth: "", placeOfBirth: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!form.dateOfBirth || !form.timeOfBirth || !form.placeOfBirth) {
      setError("Please fill in your date, time and place of birth.");
      return;
    }
    setLoading(true);
    try {
      track?.("manglik_tool_submit");
      const res = await fetch("/api/tools/manglik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: "Something went wrong. Please try again." }; }
      if (!res.ok) {
        setError(data.error || "Could not calculate. Please try again.");
      } else {
        setResult(data);
        track?.("manglik_tool_result", { isManglik: !!data.isManglik });
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Date of Birth</label>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => update("dateOfBirth", e.target.value)}
            className="w-full rounded-lg bg-background border border-border px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Time of Birth</label>
          <input
            type="time"
            value={form.timeOfBirth}
            onChange={(e) => update("timeOfBirth", e.target.value)}
            className="w-full rounded-lg bg-background border border-border px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
          <p className="text-xs text-muted mt-1">As accurate as possible — Manglik status depends on the exact ascendant.</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Place of Birth</label>
          <input
            type="text"
            placeholder="e.g. Jaipur, Rajasthan"
            value={form.placeOfBirth}
            onChange={(e) => update("placeOfBirth", e.target.value)}
            className="w-full rounded-lg bg-background border border-border px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-primary hover:opacity-90 disabled:opacity-60 text-white font-semibold py-3 transition"
        >
          {loading ? "Calculating…" : "Check My Manglik Status"}
        </button>
        <p className="text-xs text-muted text-center">
          Free · No sign-up · Uses the same astronomical engine as our full report.
        </p>
      </form>

      {result && (
        <div className="mt-8 border-t border-border pt-6">
          <div
            className={`rounded-xl p-5 text-center ${
              result.isManglik ? "bg-amber-500/10 border border-amber-500/30" : "bg-emerald-500/10 border border-emerald-500/30"
            }`}
          >
            <p className="text-sm text-muted mb-1">Your result</p>
            <p className="text-2xl font-bold mb-2">
              {result.isManglik ? "Manglik (Mangal Dosha present)" : "Not Manglik"}
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">{result.summary}</p>
          </div>

          {result.context && (
            <div className="grid grid-cols-3 gap-3 mt-4 text-center text-sm">
              <div className="bg-background rounded-lg p-3 border border-border">
                <p className="text-muted text-xs">Ascendant</p>
                <p className="font-semibold">{result.context.ascendant || "—"}</p>
              </div>
              <div className="bg-background rounded-lg p-3 border border-border">
                <p className="text-muted text-xs">Moon Rashi</p>
                <p className="font-semibold">{result.context.rashi || "—"}</p>
              </div>
              <div className="bg-background rounded-lg p-3 border border-border">
                <p className="text-muted text-xs">Mars in</p>
                <p className="font-semibold">{result.context.marsSign || "—"}</p>
              </div>
            </div>
          )}

          {/* Funnel handoff: this is the whole point of the free tool. */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted mb-3">
              {result.isManglik
                ? "Manglik status alone isn't the full picture — cancellations, remedies and marriage timing all depend on your complete chart."
                : "Want the complete picture — career, marriage timing, dashas and remedies for your exact chart?"}
            </p>
            <Link
              href="/get-report"
              onClick={() => track?.("manglik_tool_cta_click", { isManglik: !!result.isManglik })}
              className="inline-block rounded-full bg-primary hover:opacity-90 text-white font-semibold px-8 py-3 transition"
            >
              Get My Full Kundli Report →
            </Link>
            <p className="text-xs text-muted mt-2">20-page personalized report · from ₹299 · ready in 60 seconds</p>
          </div>
        </div>
      )}
    </div>
  );
}
