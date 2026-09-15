"use client";
import ToolForm from "../ToolForm";

export default function KaalSarpCalculator() {
  return (
    <ToolForm
      toolName="kaalsarp"
      buttonLabel="Check My Kaal Sarp Dosha"
      renderResult={(d) => {
        const present = d.kaalSarp?.present;
        return (
          <div className={`rounded-xl p-5 text-center ${present ? "bg-amber-500/10 border border-amber-500/30" : "bg-emerald-500/10 border border-emerald-500/30"}`}>
            <p className="text-sm text-muted mb-1">Your result</p>
            <p className="text-2xl font-bold mb-2">
              {present ? `Kaal Sarp Dosha present${d.kaalSarp?.type ? ` — ${d.kaalSarp.type}` : ""}` : "No Kaal Sarp Dosha"}
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">{d.kaalSarp?.summary}</p>
          </div>
        );
      }}
    />
  );
}
