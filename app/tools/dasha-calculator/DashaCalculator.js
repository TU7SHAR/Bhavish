"use client";
import ToolForm from "../ToolForm";

export default function DashaCalculator() {
  return (
    <ToolForm
      toolName="dasha"
      buttonLabel="Find My Current Dasha"
      renderResult={(d) => (
        <div className="rounded-xl p-5 text-center bg-primary/10 border border-primary/30">
          <p className="text-sm text-muted mb-1">Your current period (Vimshottari Dasha)</p>
          {d.dasha ? (
            <>
              <p className="text-2xl font-bold mb-1">
                {d.dasha.mahadasha} Mahadasha
              </p>
              <p className="text-sm text-foreground/80">
                {d.dasha.mahadashaStart} → {d.dasha.mahadashaEnd}
              </p>
              {d.dasha.antardasha && (
                <p className="text-sm text-foreground/80 mt-2">
                  Running Antardasha: <strong>{d.dasha.antardasha}</strong>
                  {d.dasha.antardashaEnd ? ` (until ${d.dasha.antardashaEnd})` : ""}
                </p>
              )}
            </>
          ) : (
            <p className="text-foreground/80">Could not determine the current period.</p>
          )}
        </div>
      )}
    />
  );
}
