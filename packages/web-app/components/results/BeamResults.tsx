import type { CalculationResult } from "@/lib/types-bridge"

export function BeamResults({ result }: { result: CalculationResult | null }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      Traversenergebnisse folgen nach der Anbindung der Berechnung.
      {result ? " Ergebnisdaten liegen bereits vor." : ""}
    </div>
  )
}
