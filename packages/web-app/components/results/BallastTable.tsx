import type { CalculationResult } from "@/lib/types-bridge"

export function BallastTable({ result }: { result: CalculationResult | null }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      Ballasttabelle folgt, sobald die calc-engine verbunden ist.
      {result ? " Ergebnisdaten liegen bereits vor." : ""}
    </div>
  )
}
