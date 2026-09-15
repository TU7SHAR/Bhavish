"use client";
import { useState } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics";

// Shared birth-details form for the free /tools/* calculators. Posts to
// /api/tools/chart (same deterministic engine as the paid report), then hands
// the JSON to `renderResult(data)` so each tool shows only its own slice.
//
// Props:
//   toolName    - short id for analytics (e.g. "rashi")
//   buttonLabel - CTA on the submit button
//   renderResult(data) -> JSX for the result box
export default function ToolForm({ toolName, buttonLabel = "Calculate", renderResult }) {
  const [form, setForm] = useState({ dateOfBirth: "", timeOfBirth: "", placeOfBirth: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      track?.(`${toolName}_tool_submit`);
      const res = await fetch("/api/tools/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
      } else {
        setResult(data);
        track?.(`${toolName}_tool_result`);
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
            className="w-full rounded-lg bg-background border border-border px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary [color-scheme:dark]"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Time of Birth</label>
          <input
            type="time"
            value={form.timeOfBirth}
            onChange={(e) => update("timeOfBirth", e.target.value)}
            className="w-full rounded-lg bg-background border border-border px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary [color-scheme:dark]"
            required
          />
          <p className="text-xs text-muted mt-1">As accurate as possible — the result depends on the exact ascendant.</p>
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
          {loading ? "Calculating…" : buttonLabel}
        </button>
        <p className="text-xs text-muted text-center">
          Free · No sign-up · Uses the same astronomical engine as our full report.
        </p>
      </form>

      {result && (
        <div className="mt-8 border-t border-border pt-6">
          {renderResult(result)}

          <div className="mt-6 bg-background border border-border rounded-xl p-5 text-center">
            <p className="text-muted text-sm mb-3">
              This is just one piece of your chart. Your full personalized report covers everything —
              career, marriage, dashas, remedies and your year ahead.
            </p>
            <Link
              href="/get-report"
              className="inline-block rounded-full bg-primary hover:opacity-90 text-white font-semibold px-6 py-2.5 text-sm transition"
            >
              Get My Full Kundli Report →
            </Link>
            <p className="text-xs text-muted mt-2">From ₹299 · ready in 60 seconds</p>
          </div>
        </div>
      )}
    </div>
  );
}
