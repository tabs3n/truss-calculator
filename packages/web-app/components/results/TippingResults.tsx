import type { CalculationResult } from "@/lib/types-bridge"

export function TippingResults({ result }: { result: CalculationResult | null }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      Kippsicherheitskarten folgen mit der echten Ergebnisanzeige.
      {result ? " Ergebnisdaten liegen bereits vor." : ""}
    </div>
  )
}
