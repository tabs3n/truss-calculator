import { WindSurfaceLoadList } from "@/components/results/WindSurfaceLoadList"
import { getWindDirectionDisplay } from "@/lib/constants"
import type { CalculationResult, Support, TippingDirectionResult } from "@/lib/types-bridge"

function getTippingAxisLabel(supports: Support[], tippingAxisSupportIds: string[]) {
  return tippingAxisSupportIds
    .map((id) => supports.find((support) => support.id === id)?.label ?? id)
    .join(" - ")
}

function DirectionCard({
  label,
  value,
  governing,
  supports,
}: {
  label: string
  value: TippingDirectionResult
  governing: boolean
  supports: Support[]
}) {
  const progress = `${Math.min(value.utilization, 1.3) * 100}%`

  return (
    <article
      className={`rounded-2xl border p-4 ${
        governing
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-background/85"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Kippachse: {getTippingAxisLabel(supports, value.tippingAxisSupportIds)}
          </p>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
            value.isOk ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"
          }`}
        >
          {value.isOk ? "OK" : "kritisch"}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ausnutzung eta</span>
            <span className="font-semibold">{value.utilization.toFixed(2)}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted">
            <div
              className={`h-2 rounded-full ${
                value.utilization <= 1 ? "bg-emerald-500" : "bg-destructive"
              }`}
              style={{ width: progress }}
            />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Rz,min</dt>
            <dd className="font-semibold">{value.minVerticalReactionKN.toFixed(2)} kN</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ballast gesamt</dt>
            <dd className="font-semibold">{value.requiredBallastTotalKg.toFixed(0)} kg</dd>
          </div>
        </dl>
      </div>
    </article>
  )
}

export function TippingResults({ result }: { result: CalculationResult | null }) {
  if (!result) {
    return (
      <div className="rounded-[1.5rem] border border-dashed p-4 text-sm text-muted-foreground">
        Kippsicherheitskarten erscheinen nach der Berechnung.
      </div>
    )
  }

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Kippsicherheit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Berechnete Lastfälle mit hervorgehobenem maßgebenden Nachweis.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {result.tipping.directions.map(({ angleDeg, result: directionResult }) => (
          <DirectionCard
            key={angleDeg}
            label={getWindDirectionDisplay(angleDeg)}
            value={directionResult}
            governing={result.tipping.governingAngleDeg === angleDeg}
            supports={result.input.supports}
          />
        ))}
      </div>

      <div className="mt-4">
        <WindSurfaceLoadList result={result} title="Windflächen im maßgebenden Lastfall" />
      </div>
    </section>
  )
}
