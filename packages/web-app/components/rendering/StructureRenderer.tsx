import { getOrderedBeamSupports } from "@/lib/beam-helpers"
import type { CalculationResult, StructureInput, Support } from "@/lib/types-bridge"
import { compassAngleToVector, getWindDirectionDisplay, getWindDirectionLabel } from "@/lib/constants"

function supportColor(support: Support, result: CalculationResult | null) {
  if (!result) return "#9ca3af"

  const supportResult = result.supports.find((entry) => entry.supportId === support.id)
  if (!supportResult) return "#9ca3af"

  return supportResult.isOk ? "#15803d" : "#dc2626"
}

export function StructureRenderer({
  input,
  result,
}: {
  input: StructureInput
  result: CalculationResult | null
}) {
  if (input.supports.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-card/90 p-6 text-sm text-muted-foreground">
        Noch kein Grundriss vorhanden. Lege zuerst Stützen an.
      </div>
    )
  }

  const xs = input.supports.map((support) => support.position.x)
  const ys = input.supports.map((support) => support.position.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = Math.max(maxX - minX, 1)
  const height = Math.max(maxY - minY, 1)
  const padding = 30
  const viewWidth = 500
  const viewHeight = 340
  const scale = Math.min((viewWidth - padding * 2) / width, (viewHeight - padding * 2) / height)

  const projectX = (value: number) => padding + (value - minX) * scale
  const projectY = (value: number) => viewHeight - padding - (value - minY) * scale

  const supportById = new Map(input.supports.map((support) => [support.id, support]))
  const tippingAxisIds = result?.tipping.governing.tippingAxisSupportIds
  const tippingAxisSupports = tippingAxisIds?.map((id) => supportById.get(id)).filter(Boolean) as
    | Support[]
    | undefined
  const windDirections = result?.tipping.directions ?? []
  const governingAngleDeg = result?.tipping.governingAngleDeg

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Grundriss</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Deklarative SVG-Draufsicht mit automatischer Skalierung.
          </p>
        </div>
        <div className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {result ? "Mit Ergebnis" : "Unberechnet"}
        </div>
      </div>

      <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="h-auto w-full rounded-2xl border border-border bg-background">
        <defs>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(148, 163, 184, 0.18)" strokeWidth="1" />
          </pattern>
          <marker id="wind-arrow-blue" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#2563eb" />
          </marker>
          <marker id="wind-arrow-red" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#dc2626" />
          </marker>
        </defs>

        <rect x="0" y="0" width={viewWidth} height={viewHeight} fill="url(#grid)" />

        {input.beams.map((beam) => {
          const beamSupports = getOrderedBeamSupports(beam, input.supports)

          if (beamSupports.length < 2) return null

          // Label-Position in der Mitte der Polylinie
          const first = beamSupports[0]!
          const last = beamSupports[beamSupports.length - 1]!
          const midX = (projectX(first.position.x) + projectX(last.position.x)) / 2
          const midY = (projectY(first.position.y) + projectY(last.position.y)) / 2 - 10

          return (
            <g key={beam.id}>
              {beamSupports.slice(0, -1).map((start, idx) => {
                const end = beamSupports[idx + 1]!
                return (
                  <line
                    key={`${beam.id}-seg-${idx}`}
                    x1={projectX(start.position.x)}
                    y1={projectY(start.position.y)}
                    x2={projectX(end.position.x)}
                    y2={projectY(end.position.y)}
                    stroke="#334155"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                )
              })}
              <text x={midX} y={midY} textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold">
                {beam.label}
                {beamSupports.length > 2 ? ` (${beamSupports.length} Stützen)` : ""}
              </text>
            </g>
          )
        })}

        {tippingAxisSupports?.length === 2 ? (
          <line
            x1={projectX(tippingAxisSupports[0].position.x)}
            y1={projectY(tippingAxisSupports[0].position.y)}
            x2={projectX(tippingAxisSupports[1].position.x)}
            y2={projectY(tippingAxisSupports[1].position.y)}
            stroke="#dc2626"
            strokeWidth="3"
            strokeDasharray="8 8"
          />
        ) : null}

        {input.supports.map((support) => (
          <g key={support.id}>
            <circle
              cx={projectX(support.position.x)}
              cy={projectY(support.position.y)}
              r="8"
              fill={supportColor(support, result)}
            />
            <text
              x={projectX(support.position.x)}
              y={projectY(support.position.y) - 14}
              textAnchor="middle"
              className="fill-slate-700 text-[11px] font-semibold"
            >
              {support.label}
            </text>
          </g>
        ))}

        {windDirections.length > 0 && governingAngleDeg !== undefined ? (
          <g>
            <text x="24" y="28" className="fill-slate-700 text-[12px] font-semibold">
              Berechnete Windrichtungen: {windDirections.map(({ angleDeg }) => getWindDirectionLabel(angleDeg)).join(", ")}
            </text>
            <text x="24" y="44" className="fill-red-600 text-[12px] font-semibold">
              Maßgebender Wind: {getWindDirectionDisplay(governingAngleDeg)}
            </text>
            <circle cx="82" cy="88" r="7" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
            {windDirections.map(({ angleDeg }) => {
              const vector = compassAngleToVector(angleDeg)
              const isGoverning = angleDeg === governingAngleDeg

              return (
                <g key={angleDeg}>
                  <line
                    x1={82 + vector.x * 10}
                    y1={88 + vector.y * 10}
                    x2={82 + vector.x * 40}
                    y2={88 + vector.y * 40}
                    stroke="#2563eb"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    markerEnd="url(#wind-arrow-blue)"
                  />
                  {isGoverning ? (
                    <line
                      x1={82 + vector.x * 10}
                      y1={88 + vector.y * 10}
                      x2={82 + vector.x * 48}
                      y2={88 + vector.y * 48}
                      stroke="#dc2626"
                      strokeWidth="4"
                      strokeLinecap="round"
                      markerEnd="url(#wind-arrow-red)"
                    />
                  ) : null}
                  <text
                    x={82 + vector.x * 60}
                    y={88 + vector.y * 60 + 4}
                    textAnchor="middle"
                    className={isGoverning ? "fill-red-600 text-[11px] font-semibold" : "fill-blue-600 text-[11px] font-semibold"}
                  >
                    {getWindDirectionLabel(angleDeg)}
                  </text>
                </g>
              )
            })}
          </g>
        ) : (
          <text x="24" y="28" className="fill-slate-500 text-[12px] font-semibold">
            Alle Stützen werden bis zur Berechnung neutral dargestellt.
          </text>
        )}
      </svg>
    </section>
  )
}
