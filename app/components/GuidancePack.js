"use client";

// Visual renderer for the ₹149 "12-Month Personal Guidance Pack" section.
// The section content is AI-generated free text; this component parses it into
// month-by-month cards so the buyer can clearly SEE the 12 months they paid for.
// If the text can't be parsed into months, it degrades gracefully to a nicely
// formatted card with a decorative 12-month strip — so it always looks premium.

import { useState } from "react";
import RichText from "./RichText";
import { mdToPlain } from "../../lib/markdown";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_ALT = MONTH_NAMES.join("|");
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Sub-topics we bold inside a month body for readability.
const SUBTOPIC_RE = /^(\s*[-•*]?\s*)(Career|Money|Finance|Financial|Love|Relationships?|Health|Personal Growth|Growth|Family|Work|Business)(\s*[:\-–])/i;

function boldSubtopics(text) {
  return (text || "").split("\n").map((line, idx) => {
    const m = line.match(SUBTOPIC_RE);
    if (m) {
      const rest = mdToPlain(line.slice(m[0].length));
      return (
        <span key={idx} className="block">
          <span className="text-foreground font-semibold">{mdToPlain(m[2])}</span>
          {mdToPlain(m[3].trim())} {rest}
        </span>
      );
    }
    return <span key={idx} className="block">{mdToPlain(line)}</span>;
  });
}

function parseGuidance(raw) {
  const content = (raw || "").trim();
  if (!content) return { ok: false, content };

  // Header = start of line, optional markdown (#/**), then "Month N" or a month
  // name, optional "(January)", then a separator (: . ) - – —).
  const headerRe = new RegExp(
    String.raw`(?:^|\n)[ \t]*(?:#{1,4}[ \t]*)?\*{0,2}[ \t]*((?:Month[ \t]*\d{1,2}(?:[ \t]*\(\s*(?:${MONTH_ALT})\s*\))?)|(?:${MONTH_ALT}))[ \t]*\*{0,2}[ \t]*[:.\)\-–—]`,
    "gi"
  );
  const matches = [...content.matchAll(headerRe)];
  if (matches.length < 6) return { ok: false, content };

  const intro = content.slice(0, matches[0].index).trim();
  const months = matches.map((m, i) => {
    const bodyStart = m.index + m[0].length;
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const label = m[1].replace(/\*/g, "").replace(/\s+/g, " ").trim();
    const body = content.slice(bodyStart, bodyEnd).trim();
    return { label, body };
  });

  // Pull trailing component sections (best/caution months, timing, remedies,
  // summary) out of the LAST month's body so they render as their own block.
  let outro = "";
  const compRe = /(?:^|\n)[ \t]*(?:#{1,4}[ \t]*)?\*{0,2}[ \t]*(Best Months?|Caution Months?|Key Timing Windows?|Timing Windows?|Monthly Action Plan|Action Plan|Personal Remedies|Remedies|Suggestions|Final[^\n:]*Summary|12[ -]?Month[^\n:]*Summary|Yearly[^\n:]*|Summary)\b/i;
  const last = months[months.length - 1];
  const compMatch = last.body.match(compRe);
  if (compMatch && compMatch.index > 20) {
    outro = last.body.slice(compMatch.index).trim();
    last.body = last.body.slice(0, compMatch.index).trim();
  }

  return { ok: true, intro, months, outro };
}

function PackHeader() {
  return (
    <div className="flex items-start gap-4 mb-5">
      <div className="text-3xl shrink-0">📅</div>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl md:text-2xl font-bold text-blue-300">12-Month Personal Guidance Pack</h2>
          <span className="text-[10px] uppercase tracking-wider bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-semibold">Premium Add-on</span>
        </div>
        <p className="text-muted text-sm mt-1">
          Your month-by-month guidance for the year ahead — career, money, relationships, health, timing windows and remedies.
        </p>
      </div>
    </div>
  );
}

export default function GuidancePack({ title, content }) {
  const parsed = parseGuidance(content);
  const [openMonth, setOpenMonth] = useState(null);

  // ---- Fallback: couldn't parse months. Keep it premium-looking. ----
  if (!parsed.ok) {
    return (
      <div className="rounded-2xl p-6 md:p-8 bg-gradient-to-br from-blue-500/10 via-primary/5 to-surface border-2 border-blue-400/40">
        <PackHeader />
        {/* Decorative 12-month strip so it still reads as "12 months" */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {MONTH_ABBR.map((mo) => (
            <span key={mo} className="text-[11px] px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-400/20 text-blue-200">{mo}</span>
          ))}
        </div>
        <RichText text={parsed.content} className="text-muted leading-relaxed" />
      </div>
    );
  }

  const { intro, months, outro } = parsed;

  return (
    <div className="rounded-2xl p-6 md:p-8 bg-gradient-to-br from-blue-500/10 via-primary/5 to-surface border-2 border-blue-400/40">
      <PackHeader />

      {intro && (
        <RichText text={intro} className="text-muted leading-relaxed mb-5 bg-black/10 border border-blue-400/10 rounded-xl p-4" />
      )}

      {/* Month timeline chips — quick visual overview + jump */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {months.map((m, i) => (
          <button
            key={i}
            onClick={() => setOpenMonth(openMonth === i ? null : i)}
            className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
              openMonth === i
                ? "bg-blue-500/30 border-blue-400/50 text-white"
                : "bg-blue-500/10 border-blue-400/20 text-blue-200 hover:border-blue-400/40"
            }`}
          >
            {MONTH_ABBR[i] || `M${i + 1}`}
          </button>
        ))}
      </div>

      {/* Month cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {months.map((m, i) => (
          <div
            key={i}
            id={`guidance-month-${i}`}
            className={`rounded-xl p-4 border transition-colors bg-surface/60 ${
              openMonth === i ? "border-blue-400/60 ring-1 ring-blue-400/30" : "border-border hover:border-blue-400/30"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-blue-500/25 text-blue-200 text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <h3 className="text-sm font-semibold text-blue-200 leading-tight">{m.label}</h3>
            </div>
            <div className="text-xs text-muted leading-relaxed">
              {boldSubtopics(m.body)}
            </div>
          </div>
        ))}
      </div>

      {/* Timing windows / remedies / yearly summary */}
      {outro && (
        <div className="mt-5 rounded-xl p-4 bg-blue-500/5 border border-blue-400/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">🗝️</span>
            <h3 className="text-sm font-semibold text-blue-200">Key Windows, Remedies &amp; Yearly Summary</h3>
          </div>
          <RichText text={outro} className="text-xs text-muted leading-relaxed" />
        </div>
      )}
    </div>
  );
}
