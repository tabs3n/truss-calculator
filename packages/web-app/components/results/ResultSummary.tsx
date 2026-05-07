import type { CalculationResult } from "@/lib/types-bridge"

export function ResultSummary({ result }: { result: CalculationResult | null }) {
  if (!result) {
    return (
      <div className="rounded-lg border p-6 text-center text-muted-foreground">
        Eingaben vervollstaendigen und Berechnung starten
      </div>
    )
  }

  return <div>Ergebnis: {result.overallOk ? "OK" : "NICHT OK"}</div>
}
