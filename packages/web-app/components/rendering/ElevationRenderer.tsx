import { getOrderedBeamSupports } from "@/lib/beam-helpers"
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

  // Stützen am gleichen X: Labels vertikal gestaffeln damit sie nicht übereinander kleben
  const xLabelCounter = new Map<string, number>()
  const supportMeta = orderedSupports.map((s) => {
    const key = s.position.x.toFixed(1)
    const xIdx = xLabelCounter.get(key) ?? 0
    xLabelCounter.set(key, xIdx + 1)
    const isLeft = Math.abs(s.position.x - minX) < 0.15
    const isRight = Math.abs(s.position.x - maxX) < 0.15
    return { xIdx, isLeft, isRight }
  })

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

        {orderedSupports.map((support, sIdx) => {
          const x = projectX(support.position.x)
          const topY = projectHeight(support.height, maxHeight, viewHeight)
          const meta = supportMeta[sIdx]!
          const anchor = meta.isLeft ? "start" : meta.isRight ? "end" : "middle"
          const labelX = meta.isLeft ? x + 4 : meta.isRight ? x - 4 : x
          // Label-Y: für jede weitere Stütze am gleichen X um 13 px nach oben versetzt
          const labelY = topY - 10 - meta.xIdx * 13

          return (
            <g key={support.id}>
              <line x1={x} y1="264" x2={x} y2={topY} stroke="#475569" strokeWidth="5" strokeLinecap="round" />
              <text x={labelX} y={labelY} textAnchor={anchor} className="fill-slate-700 text-[11px] font-semibold">
                {support.label}
              </text>
              {/* Höhenangabe nur beim ersten Vorkommen dieses X-Werts */}
              {meta.xIdx === 0 ? (
                <text x={labelX} y="250" textAnchor={anchor} className="fill-slate-500 text-[10px]">
                  {support.height.toFixed(1)} m
                </text>
              ) : null}
            </g>
          )
        })}

        {input.beams.map((beam) => {
          const supports = getOrderedBeamSupports(beam, input.supports)
          if (supports.length < 2) return null

          const first = supports[0]!
          const last = supports[supports.length - 1]!
          const startX = projectX(first.position.x)
          const endX = projectX(last.position.x)
          const startY = projectHeight(first.height, maxHeight, viewHeight)
          const endY = projectHeight(last.height, maxHeight, viewHeight)
          const beamY = Math.min(startY, endY)

          // Spannweiten und cumulative position für Lastenverteilung entlang Polylinie
          let totalSpan = 0
          for (let i = 0; i < supports.length - 1; i++) {
            const a = supports[i]!
            const b = supports[i + 1]!
            totalSpan += Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y)
          }
          const totalBeamLength = beam.cantileverStart + totalSpan + beam.cantileverEnd

          return (
            <g key={beam.id}>
              {/* Segmente zwischen aufeinanderfolgenden Stützen */}
              {supports.slice(0, -1).map((s, idx) => {
                const e = supports[idx + 1]!
                return (
                  <line
                    key={`${beam.id}-seg-${idx}`}
                    x1={projectX(s.position.x)}
                    y1={projectHeight(s.height, maxHeight, viewHeight)}
                    x2={projectX(e.position.x)}
                    y2={projectHeight(e.height, maxHeight, viewHeight)}
                    stroke="#0f172a"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                )
              })}
              <text
                x={(startX + endX) / 2}
                y={beamY - 12}
                textAnchor="middle"
                className="fill-slate-700 text-[11px] font-semibold"
              >
                {beam.label}
                {supports.length > 2 ? ` · ${supports.length} Stützen` : ""}
              </text>

              {beam.loads.map((load) => {
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

              {/* Streckenlasten als blaues Rechteck mit Pfeilen darüber */}
              {(beam.distributedLoads ?? []).map((dl) => {
                const startRatio = Math.max(0, Math.min(1, (dl.startPositionM + beam.cantileverStart) / Math.max(totalBeamLength, 0.01)))
                const endRatio = Math.max(0, Math.min(1, (dl.endPositionM + beam.cantileverStart) / Math.max(totalBeamLength, 0.01)))
                const x1 = startX + (endX - startX) * startRatio
                const x2 = startX + (endX - startX) * endRatio
                return (
                  <g key={dl.id} opacity="0.7">
                    <rect
                      x={Math.min(x1, x2)}
                      y={beamY - 24}
                      width={Math.abs(x2 - x1)}
                      height={10}
                      fill="#60a5fa"
                      stroke="#1d4ed8"
                      strokeWidth="0.5"
                    />
                    <text
                      x={(x1 + x2) / 2}
                      y={beamY - 28}
                      textAnchor="middle"
                      className="fill-blue-700 text-[9px] font-medium"
                    >
                      {dl.loadKgPerM.toFixed(0)} kg/m
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
