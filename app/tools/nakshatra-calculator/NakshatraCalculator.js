"use client";
import ToolForm from "../ToolForm";

export default function NakshatraCalculator() {
  return (
    <ToolForm
      toolName="nakshatra"
      buttonLabel="Find My Nakshatra"
      renderResult={(d) => (
        <div className="rounded-xl p-5 text-center bg-primary/10 border border-primary/30">
          <p className="text-sm text-muted mb-1">Your Birth Nakshatra</p>
          <p className="text-2xl font-bold mb-2">{d.nakshatra?.name || "—"}</p>
          {d.nakshatra && (
            <p className="text-sm text-foreground/80">
              Pada <strong>{d.nakshatra.pada}</strong> · Ruling planet <strong>{d.nakshatra.ruler}</strong>
            </p>
          )}
          {d.rashi && <p className="text-sm text-foreground/70 mt-1">Moon sign: {d.rashi}</p>}
        </div>
      )}
    />
  );
}
