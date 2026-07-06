"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Client component that fetches + displays individual monthly guidance reports.
// Shown on the user dashboard when they have the ₹149 add-on.
// Renders: generated months as expandable cards, future months as "Coming Soon".

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export default function MonthlyGuidanceSection({ reportId, startDate, currentMonth }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/guidance-reports?reportId=${encodeURIComponent(reportId)}`);
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports || []);
        }
      } catch (e) {
        console.error("Failed to load guidance reports:", e);
      }
      setLoading(false);
    })();
  }, [reportId]);

  const start = new Date(startDate);
  const startMonthIdx = start.getMonth();
  const startYear = start.getFullYear();

  // Build 12-month array
  const months = Array.from({ length: 12 }, (_, i) => {
    const moIdx = (startMonthIdx + i) % 12;
    const year = startYear + Math.floor((startMonthIdx + i) / 12);
    const monthNum = i + 1;
    const report = reports.find((r) => r.month_number === monthNum);
    const isAvailable = monthNum <= currentMonth;
    const isGenerated = !!report;
    return { monthNum, moIdx, year, report, isAvailable, isGenerated, label: MONTH_NAMES[moIdx] };
  });

  if (loading) {
    return (
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-blue-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-5 h-px bg-blue-500/50" />Monthly Guidance Reports
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-surface/40 border border-border rounded-xl p-4 animate-pulse">
              <div className="w-16 h-4 bg-white/5 rounded mb-2" />
              <div className="w-24 h-3 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Calculate the date when the next month becomes available
  const nextMonthDate = currentMonth < 12
    ? new Date(start.getTime() + currentMonth * 30.44 * 24 * 60 * 60 * 1000)
    : null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-blue-300 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className="w-5 h-px bg-blue-500/50" />Monthly Guidance Reports
      </h3>

      {/* Live countdown to next report */}
      {nextMonthDate && currentMonth < 12 && (
        <NextReportTimer nextDate={nextMonthDate} nextMonth={currentMonth + 1} />
      )}
      {currentMonth >= 12 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 mb-4 text-center">
          <p className="text-sm text-green-300">All 12 months of your guidance period are now available.</p>
        </div>
      )}

      {/* Month cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
        {months.map((m) => (
          <button
            key={m.monthNum}
            onClick={() => m.isGenerated ? setExpandedMonth(expandedMonth === m.monthNum ? null : m.monthNum) : null}
            disabled={!m.isGenerated}
            className={`relative text-left rounded-xl p-4 border transition-all ${
              m.isGenerated
                ? expandedMonth === m.monthNum
                  ? "bg-blue-500/20 border-blue-400/60 ring-1 ring-blue-400/30"
                  : "bg-surface/60 border-blue-400/30 hover:border-blue-400/50 cursor-pointer"
                : m.isAvailable
                  ? "bg-surface/40 border-amber-400/20"
                  : "bg-surface/20 border-border opacity-60"
            }`}
          >
            {/* Month number badge */}
            <div className="flex items-center justify-between mb-2">
              <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
                m.isGenerated ? "bg-blue-500/30 text-blue-200" : m.isAvailable ? "bg-amber-500/20 text-amber-300" : "bg-white/5 text-gray-600"
              }`}>
                {m.monthNum}
              </span>
              {m.isGenerated && (
                <span className="text-[9px] uppercase tracking-wider bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-semibold">Ready</span>
              )}
              {!m.isGenerated && m.isAvailable && (
                <span className="text-[9px] uppercase tracking-wider bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-semibold">Pending</span>
              )}
            </div>
            <p className="text-sm font-semibold text-foreground">{m.label}</p>
            <p className="text-[11px] text-muted">{m.year}</p>
            {!m.isAvailable && (
              <p className="text-[10px] text-gray-500 mt-1">Coming soon</p>
            )}
            {m.isGenerated && (
              <p className="text-[10px] text-blue-300 mt-1">{expandedMonth === m.monthNum ? "▾ Tap to close" : "▸ Tap to read"}</p>
            )}
          </button>
        ))}
      </div>

      {/* Expanded month content */}
      {expandedMonth && (() => {
        const m = months.find((mo) => mo.monthNum === expandedMonth);
        if (!m || !m.report) return null;
        const sections = m.report.sections || [];
        return (
          <div className="bg-gradient-to-br from-blue-500/10 via-surface to-surface border-2 border-blue-400/40 rounded-2xl p-6 animate-in fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-blue-500/30 text-blue-200 text-sm font-bold flex items-center justify-center">{m.monthNum}</span>
                <div>
                  <h3 className="text-lg font-bold text-blue-200">{m.label} {m.year} Guidance</h3>
                  <p className="text-[11px] text-muted">Generated {new Date(m.report.generated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
              </div>
              <button
                onClick={() => setExpandedMonth(null)}
                className="text-gray-400 hover:text-white text-xl transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Sections */}
            <div className="space-y-4">
              {sections.map((section, i) => (
                <div key={i} className="bg-surface/50 border border-border rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-blue-300 mb-2">{section.title}</h4>
                  <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{section.content}</p>
                </div>
              ))}
              {sections.length === 0 && m.report.full_text && (
                <div className="bg-surface/50 border border-border rounded-xl p-4">
                  <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{m.report.full_text}</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Info text */}
      {reports.length === 0 && (
        <div className="bg-surface/30 border border-border rounded-xl p-4 text-center">
          <p className="text-sm text-muted">Your first monthly guidance report will be generated and sent to your email soon. Check back here to read it anytime.</p>
        </div>
      )}
    </div>
  );
}


// Live countdown timer showing when the next monthly report becomes available
function NextReportTimer({ nextDate, nextMonth }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const diff = nextDate - now;
      if (diff <= 0) {
        setTimeLeft("Available now!");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [nextDate]);

  return (
    <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-4 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
          <span className="text-lg">⏳</span>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Next report: Month {nextMonth}</p>
          <p className="text-xs text-muted">Your next monthly guidance will be ready in</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-blue-300 font-mono">{timeLeft}</p>
        <p className="text-[10px] text-gray-500">{nextDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
      </div>
    </div>
  );
}
