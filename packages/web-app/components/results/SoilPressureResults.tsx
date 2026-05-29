import type { CalculationResult, Support } from "@/lib/types-bridge"

function supportLabel(supports: Support[], id: string) {
  return supports.find((s) => s.id === id)?.label ?? id
}

export function SoilPressureResults({ result }: { result: CalculationResult | null }) {
  if (!result) return null
  const soil = result.soilPressure
  if (!soil || soil.supports.length === 0) return null

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Bodenpressung</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sohldruck je Stütze gegen zulässigen Wert des Untergrunds.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
            zul. σ = {soil.allowableKNm2.toFixed(0)} kN/m²
          </span>
          <span
            className={`rounded-full px-2.5 py-1 font-semibold uppercase tracking-[0.18em] ${
              soil.isOk ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"
            }`}
          >
            {soil.isOk ? "OK" : "kritisch"}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {soil.supports.map((entry) => {
          const fillPct = Math.min(entry.utilization, 1.5) / 1.5 * 100
          return (
            <div key={entry.supportId}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{supportLabel(result.input.supports, entry.supportId)}</span>
                <span className={entry.isOk ? "text-muted-foreground" : "font-semibold text-destructive"}>
                  {entry.pressureKNm2.toFixed(0)} kN/m² · η = {entry.utilization.toFixed(2)}
                </span>
              </div>
              <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${entry.isOk ? "bg-emerald-500" : "bg-destructive"}`}
                  style={{ width: `${fillPct}%` }}
                />
                <div className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${(1 / 1.5) * 100}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Aufstandsfläche {entry.contactAreaM2.toFixed(2)} m²
              </p>
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Vereinfachter Nachweis mit Bemessungslast (γ<sub>G</sub>=1,35). Orientierungswerte – im
        Zweifel Bodengutachten.
      </p>
    </section>
  )
}
