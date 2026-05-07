import type { CalculationResult } from "@/lib/types-bridge"

const governingLabels: Record<CalculationResult["tipping"]["governingDirection"], string> = {
  windPlusX: "Wind +X",
  windPlusY: "Wind +Y",
  windMinusX: "Wind -X",
  windMinusY: "Wind -Y",
}

export function ResultSummary({ result }: { result: CalculationResult | null }) {
  if (!result) {
    return (
      <div className="rounded-[1.5rem] border border-border/80 bg-card/90 p-6 text-center text-muted-foreground shadow-sm">
        Eingaben vervollstaendigen und Berechnung starten
      </div>
    )
  }

  return (
    <section
      className={`rounded-[1.5rem] border p-6 shadow-sm ${
        result.overallOk
          ? "border-emerald-300 bg-emerald-50/70"
          : "border-destructive/40 bg-destructive/10"
      }`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Ergebnisueberblick
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {result.overallOk ? "Standsicher" : "Nicht standsicher"}
            </h2>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${
              result.overallOk
                ? "bg-emerald-600 text-white"
                : "bg-destructive text-destructive-foreground"
            }`}
          >
            {result.overallOk ? "OK" : "Pruefen"}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/50 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">Erforderlicher Ballast gesamt</p>
            <p className="mt-2 text-3xl font-semibold">
              {result.requiredBallastTotalKg.toFixed(0)} kg
            </p>
          </div>
          <div className="rounded-2xl border border-white/50 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">Massgebender Lastfall</p>
            <p className="mt-2 text-lg font-semibold">
              {governingLabels[result.tipping.governingDirection]}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Gleitballast: {Math.max(0, result.sliding.requiredBallastKg).toFixed(0)} kg
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/50 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">Winddruck qp</p>
            <p className="mt-1 text-xl font-semibold">
              {result.windLoad.peakVelocityPressure.toFixed(2)} kN/m²
            </p>
          </div>
          <div className="rounded-2xl border border-white/50 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">Gleiten</p>
            <p className="mt-1 text-xl font-semibold">{result.sliding.isOk ? "OK" : "Zusatzballast"}</p>
          </div>
          <div className="rounded-2xl border border-white/50 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">Berechnet am</p>
            <p className="mt-1 text-sm font-semibold">
              {new Date(result.calculatedAt).toLocaleString("de-DE")}
            </p>
          </div>
        </div>

        {result.errors.length > 0 ? (
          <div className="rounded-2xl border border-destructive/30 bg-background/75 p-4">
            <h3 className="text-sm font-semibold text-destructive">Fehler</h3>
            <ul className="mt-2 space-y-2 text-sm text-destructive">
              {result.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {result.warnings.length > 0 ? (
          <div className="rounded-2xl border border-amber-300 bg-background/75 p-4">
            <h3 className="text-sm font-semibold text-amber-700">Warnungen</h3>
            <ul className="mt-2 space-y-2 text-sm text-amber-700">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}
