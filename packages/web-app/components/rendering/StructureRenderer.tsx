import type { CalculationResult, StructureInput, Support } from "@/lib/types-bridge"

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
        Noch kein Grundriss vorhanden. Lege zuerst Stuetzen an.
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
  const windDirection = result?.tipping.governingDirection

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
          <marker id="wind-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#dc2626" />
          </marker>
        </defs>

        <rect x="0" y="0" width={viewWidth} height={viewHeight} fill="url(#grid)" />

        {input.beams.map((beam) => {
          const start = supportById.get(beam.startSupportId)
          const end = supportById.get(beam.endSupportId)

          if (!start || !end) return null

          return (
            <g key={beam.id}>
              <line
                x1={projectX(start.position.x)}
                y1={projectY(start.position.y)}
                x2={projectX(end.position.x)}
                y2={projectY(end.position.y)}
                stroke="#334155"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <text
                x={(projectX(start.position.x) + projectX(end.position.x)) / 2}
                y={(projectY(start.position.y) + projectY(end.position.y)) / 2 - 10}
                textAnchor="middle"
                className="fill-slate-700 text-[11px] font-semibold"
              >
                {beam.label}
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

        {windDirection ? (
          <g>
            <text x="24" y="28" className="fill-red-600 text-[12px] font-semibold">
              Massgebender Wind: {windDirection}
            </text>
            <line
              x1={56}
              y1={54}
              x2={
                windDirection === "windPlusX"
                  ? 126
                  : windDirection === "windMinusX"
                    ? 16
                    : 56
              }
              y2={
                windDirection === "windPlusY"
                  ? 14
                  : windDirection === "windMinusY"
                    ? 104
                    : 54
              }
              stroke="#dc2626"
              strokeWidth="3"
              markerEnd="url(#wind-arrow)"
            />
          </g>
        ) : (
          <text x="24" y="28" className="fill-slate-500 text-[12px] font-semibold">
            Alle Stuetzen werden bis zur Berechnung neutral dargestellt.
          </text>
        )}
      </svg>
    </section>
  )
}
