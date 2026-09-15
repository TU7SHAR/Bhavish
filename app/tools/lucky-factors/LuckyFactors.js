"use client";
import ToolForm from "../ToolForm";

export default function LuckyFactors() {
  return (
    <ToolForm
      toolName="lucky"
      buttonLabel="Find My Lucky Factors"
      renderResult={(d) => (
        <div className="rounded-xl p-5 bg-primary/10 border border-primary/30">
          <p className="text-sm text-muted mb-3 text-center">Your lucky factors (from your Ascendant)</p>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-background rounded-lg p-3 border border-border">
              <p className="text-muted text-xs">Gemstone</p>
              <p className="font-semibold">{d.lucky?.gem || "—"}</p>
            </div>
            <div className="bg-background rounded-lg p-3 border border-border">
              <p className="text-muted text-xs">Lucky Colour</p>
              <p className="font-semibold">{d.lucky?.color || "—"}</p>
            </div>
            <div className="bg-background rounded-lg p-3 border border-border">
              <p className="text-muted text-xs">Lucky Numbers</p>
              <p className="font-semibold">{d.lucky?.lucky || "—"}</p>
            </div>
            <div className="bg-background rounded-lg p-3 border border-border">
              <p className="text-muted text-xs">Lucky Day</p>
              <p className="font-semibold">{d.lucky?.day || "—"}</p>
            </div>
          </div>
          {d.context?.ascendant && (
            <p className="text-xs text-muted text-center mt-3">Based on Ascendant: {d.context.ascendant}</p>
          )}
        </div>
      )}
    />
  );
}
