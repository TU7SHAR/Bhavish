"use client";
import ToolForm from "../ToolForm";

export default function RashiCalculator() {
  return (
    <ToolForm
      toolName="rashi"
      buttonLabel="Find My Moon Sign (Rashi)"
      renderResult={(d) => (
        <div className="rounded-xl p-5 text-center bg-primary/10 border border-primary/30">
          <p className="text-sm text-muted mb-1">Your Moon Sign (Rashi)</p>
          <p className="text-2xl font-bold mb-2">{d.rashi || "—"}</p>
          {d.context?.ascendant && (
            <p className="text-sm text-foreground/80">Ascendant (Lagna): <strong>{d.context.ascendant}</strong></p>
          )}
        </div>
      )}
    />
  );
}
