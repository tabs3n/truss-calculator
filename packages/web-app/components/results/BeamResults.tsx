import { WindSurfaceLoadList } from "@/components/results/WindSurfaceLoadList"
import type { CalculationResult } from "@/lib/types-bridge"

function UtilizationBar({
  value,
  tone,
}: {
  value: number
  tone: "emerald" | "amber" | "destructive"
}) {
  const SCALE_MAX = 1.5
  const clamped = Math.min(Math.max(value, 0), SCALE_MAX)
  const fillPct = (clamped / SCALE_MAX) * 100
  const limitMarkerPct = (1 / SCALE_MAX) * 100
  const color =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-destructive"

  return (
    <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-muted">
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${color}`}
        style={{ width: `${fillPct}%` }}
      />
      <div
        className="absolute inset-y-0 w-px bg-foreground/40"
        style={{ left: `${limitMarkerPct}%` }}
        aria-label="1,0-Grenze"
      />
    </div>
  )
}

export function BeamResults({ result }: { result: CalculationResult | null }) {
  if (!result) {
    return (
      <div className="rounded-[1.5rem] border border-dashed p-4 text-sm text-muted-foreground">
        Traversenergebnisse erscheinen nach der Berechnung.
      </div>
    )
  }

  const beamLabelById = new Map(result.input.beams.map((beam) => [beam.id, beam.label]))

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Traversenausnutzung</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Biegung, Querkraft, Durchbiegung und Windflächen je Traverse.
        </p>
      </div>

      <div className="space-y-4">
        {result.beams.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Keine Traversenergebnisse vorhanden.
          </div>
        ) : null}

        {result.beams.map((beam) => {
          const governing = Math.max(beam.bendingUtilization, beam.shearUtilization)
          const tone =
            governing <= 0.8 ? "emerald" : governing <= 1 ? "amber" : "destructive"

          return (
            <article key={beam.beamId} className="rounded-2xl border border-border bg-background/85 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    {beamLabelById.get(beam.beamId) ?? beam.beamId}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {beam.isOk ? "Nachweis innerhalb der Grenzwerte" : beam.failureReason ?? "Nachweis nicht erfuellt"}
                  </p>
                </div>
                <div
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                    beam.isOk ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {beam.isOk ? "OK" : "Nicht OK"}
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Biegung eta</p>
                  <p className="mt-1 text-lg font-semibold">{beam.bendingUtilization.toFixed(2)}</p>
                  <UtilizationBar value={beam.bendingUtilization} tone={tone} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Querkraft eta</p>
                  <p className="mt-1 text-lg font-semibold">{beam.shearUtilization.toFixed(2)}</p>
                  <UtilizationBar value={beam.shearUtilization} tone={tone} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">M_max</p>
                  <p className="mt-1 text-lg font-semibold">{beam.maxBendingMomentKNm.toFixed(2)} kNm</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Durchbiegung</p>
                  <p className="mt-1 text-lg font-semibold">{beam.maxDeflectionMm.toFixed(1)} mm</p>
                </div>
              </div>

              <div className="mt-4">
                <WindSurfaceLoadList
                  result={result}
                  beamId={beam.beamId}
                  title="Windflächen im maßgebenden Lastfall"
                />
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
