import type { CalculationResult, StructureInput } from "@/lib/types-bridge"

function projectHeight(value: number, maxHeight: number, viewHeight: number) {
  const paddingTop = 36
  const paddingBottom = 36
  const drawableHeight = viewHeight - paddingTop - paddingBottom

  return viewHeight - paddingBottom - (value / Math.max(maxHeight, 1)) * drawableHeight
}

export function ElevationRenderer({
  input,
  result,
}: {
  input: StructureInput
  result: CalculationResult | null
}) {
  if (input.supports.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-card/90 p-6 text-sm text-muted-foreground">
        Elevation erscheint, sobald Stützen und Traversen vorhanden sind.
      </div>
    )
  }

  const orderedSupports = [...input.supports].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
  const supportById = new Map(input.supports.map((support) => [support.id, support]))
  const minX = orderedSupports[0]?.position.x ?? 0
  const maxX = orderedSupports[orderedSupports.length - 1]?.position.x ?? minX + 1
  const width = Math.max(maxX - minX, 1)
  const maxHeight = Math.max(...input.supports.map((support) => support.height), 1)
  const viewWidth = 520
  const viewHeight = 300
  const paddingX = 36
  const projectX = (value: number) => paddingX + ((value - minX) / width) * (viewWidth - paddingX * 2)

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Elevation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Seitenansicht für Höhen, Lastpfeile und Windhinweise.
          </p>
        </div>
        <div className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {result?.windLoad ? `qp ${result.windLoad.peakVelocityPressure.toFixed(2)} kN/m²` : "qp folgt nach Berechnung"}
        </div>
      </div>

      <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="h-auto w-full rounded-2xl border border-border bg-background">
        <defs>
          <marker id="load-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="#1d4ed8" />
          </marker>
          <marker id="wind-arrow-side" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#dc2626" />
          </marker>
        </defs>

        <line x1="20" y1="264" x2="500" y2="264" stroke="#94a3b8" strokeWidth="2" />
        <text x="24" y="282" className="fill-slate-500 text-[11px]">
          Bodenlinie
        </text>

        {orderedSupports.map((support) => {
          const x = projectX(support.position.x)
          const topY = projectHeight(support.height, maxHeight, viewHeight)

          return (
            <g key={support.id}>
              <line x1={x} y1="264" x2={x} y2={topY} stroke="#475569" strokeWidth="5" strokeLinecap="round" />
              <text x={x} y={topY - 10} textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold">
                {support.label}
              </text>
              <text x={x} y="250" textAnchor="middle" className="fill-slate-500 text-[10px]">
                {support.height.toFixed(1)} m
              </text>
            </g>
          )
        })}

        {input.beams.map((beam) => {
          const start = supportById.get(beam.startSupportId)
          const end = supportById.get(beam.endSupportId)
          if (!start || !end) return null

          const startX = projectX(start.position.x)
          const endX = projectX(end.position.x)
          const startY = projectHeight(start.height, maxHeight, viewHeight)
          const endY = projectHeight(end.height, maxHeight, viewHeight)
          const beamY = Math.min(startY, endY)

          return (
            <g key={beam.id}>
              <line x1={startX} y1={beamY} x2={endX} y2={beamY} stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <text
                x={(startX + endX) / 2}
                y={beamY - 12}
                textAnchor="middle"
                className="fill-slate-700 text-[11px] font-semibold"
              >
                {beam.label}
              </text>

              {beam.loads.map((load) => {
                const spanLength = Math.hypot(end.position.x - start.position.x, end.position.y - start.position.y)
                const totalBeamLength = beam.cantileverStart + spanLength + beam.cantileverEnd
                const ratio = (load.positionAlongBeam + beam.cantileverStart) / Math.max(totalBeamLength, 0.01)
                const clampedRatio = Math.min(1, Math.max(0, ratio))
                const x = startX + (endX - startX) * clampedRatio

                return (
                  <g key={load.id}>
                    <line
                      x1={x}
                      y1={beamY - 12}
                      x2={x}
                      y2={beamY + 34}
                      stroke="#1d4ed8"
                      strokeWidth="2"
                      markerEnd="url(#load-arrow)"
                    />
                    <text x={x} y={beamY + 50} textAnchor="middle" className="fill-blue-700 text-[10px] font-medium">
                      {load.weight.toFixed(0)} kg
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })}

        <g>
          <text x="406" y="34" className="fill-red-600 text-[12px] font-semibold">
            Wind
          </text>
          <line x1="406" y1="54" x2="486" y2="54" stroke="#dc2626" strokeWidth="3" markerEnd="url(#wind-arrow-side)" />
          <text x="406" y="74" className="fill-slate-500 text-[10px]">
            {result?.windLoad ? `${result.windLoad.referenceHeight.toFixed(1)} m Referenzhoehe` : "Berechnung noch nicht verbunden"}
          </text>
        </g>
      </svg>
    </section>
  )
}
