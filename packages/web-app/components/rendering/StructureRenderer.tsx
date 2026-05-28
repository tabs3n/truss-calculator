"use client"

import { useCallback, useMemo, useRef, useState, type PointerEvent } from "react"

import { getOrderedBeamSupports } from "@/lib/beam-helpers"
import { getBeamDisplayHeightM } from "@/lib/frame-geometry"
import type { CalculationResult, StructureInput, Support } from "@/lib/types-bridge"
import { compassAngleToVector, getWindDirectionDisplay, getWindDirectionLabel } from "@/lib/constants"

const VIEW_WIDTH = 500
const VIEW_HEIGHT = 360
const PADDING = 30
const DRAG_SNAP_M = 0.1   // Rasten auf 10 cm
// Kompass oben-rechts, damit er nicht mit Struktur-Labels überlappt
const COMPASS_CX = VIEW_WIDTH - 75   // 425
const COMPASS_CY = 95

function supportColor(support: Support, result: CalculationResult | null) {
  if (!result) return "#9ca3af"
  const supportResult = result.supports.find((entry) => entry.supportId === support.id)
  if (!supportResult) return "#9ca3af"
  return supportResult.isOk ? "#15803d" : "#dc2626"
}

interface DragState {
  supportId: string
  pointerId: number
  startScreenX: number
  startScreenY: number
  startWorldX: number
  startWorldY: number
}

export function StructureRenderer({
  input,
  result,
  onSupportsChange,
}: {
  input: StructureInput
  result: CalculationResult | null
  /** Wenn gesetzt: Stützen sind per Drag & Drop verschiebbar */
  onSupportsChange?: (supports: Support[]) => void
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [, forceRender] = useState({})
  const [hoveredWindAngle, setHoveredWindAngle] = useState<number | null>(null)

  // Projektion (basierend auf aktuellem input)
  const projection = useMemo(() => {
    if (input.supports.length === 0) return null
    const xs = input.supports.map((s) => s.position.x)
    const ys = input.supports.map((s) => s.position.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const width = Math.max(maxX - minX, 1)
    const height = Math.max(maxY - minY, 1)
    const scale = Math.min((VIEW_WIDTH - PADDING * 2) / width, (VIEW_HEIGHT - PADDING * 2) / height)
    return { minX, minY, scale }
  }, [input.supports])

  const projectX = useCallback(
    (value: number) => (projection ? PADDING + (value - projection.minX) * projection.scale : 0),
    [projection],
  )
  const projectY = useCallback(
    (value: number) => (projection ? VIEW_HEIGHT - PADDING - (value - projection.minY) * projection.scale : 0),
    [projection],
  )

  // Inverse Projektion: Screen-Koordinaten (SVG-Viewport) → Welt-Koordinaten
  const unprojectX = useCallback(
    (screenX: number) => (projection ? (screenX - PADDING) / projection.scale + projection.minX : 0),
    [projection],
  )
  const unprojectY = useCallback(
    (screenY: number) => (projection ? (VIEW_HEIGHT - PADDING - screenY) / projection.scale + projection.minY : 0),
    [projection],
  )

  // Konvertiert MouseEvent-Client-Koordinaten in SVG-Viewport-Koordinaten
  const clientToSvg = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const ratioX = VIEW_WIDTH / rect.width
    const ratioY = VIEW_HEIGHT / rect.height
    return {
      x: (clientX - rect.left) * ratioX,
      y: (clientY - rect.top) * ratioY,
    }
  }, [])

  // ─── Drag-Handler ─────────────────────────────────────────────
  const onSupportPointerDown = useCallback(
    (event: PointerEvent<SVGGElement>, support: Support) => {
      if (!onSupportsChange) return
      event.stopPropagation()
      const svgPos = clientToSvg(event.clientX, event.clientY)
      if (!svgPos) return
      ;(event.target as Element).setPointerCapture?.(event.pointerId)
      dragRef.current = {
        supportId: support.id,
        pointerId: event.pointerId,
        startScreenX: svgPos.x,
        startScreenY: svgPos.y,
        startWorldX: support.position.x,
        startWorldY: support.position.y,
      }
    },
    [onSupportsChange, clientToSvg],
  )

  const onSupportPointerMove = useCallback(
    (event: PointerEvent<SVGGElement>) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      const svgPos = clientToSvg(event.clientX, event.clientY)
      if (!svgPos) return
      const newWorldX = unprojectX(svgPos.x)
      const newWorldY = unprojectY(svgPos.y)
      // Snap auf 0,1 m
      const snappedX = Math.round(newWorldX / DRAG_SNAP_M) * DRAG_SNAP_M
      const snappedY = Math.round(newWorldY / DRAG_SNAP_M) * DRAG_SNAP_M
      onSupportsChange?.(
        input.supports.map((s) =>
          s.id === drag.supportId ? { ...s, position: { x: snappedX, y: snappedY } } : s,
        ),
      )
      forceRender({})
    },
    [clientToSvg, unprojectX, unprojectY, onSupportsChange, input.supports],
  )

  const onSupportPointerUp = useCallback((event: PointerEvent<SVGGElement>) => {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    ;(event.target as Element).releasePointerCapture?.(event.pointerId)
    dragRef.current = null
  }, [])

  if (input.supports.length === 0 || !projection) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-card/90 p-6 text-sm text-muted-foreground">
        Noch kein Grundriss vorhanden. Lege zuerst Stützen an.
      </div>
    )
  }

  const supportById = new Map(input.supports.map((support) => [support.id, support]))
  const windDirections = result?.tipping.directions ?? []
  const governingAngleDeg = result?.tipping.governingAngleDeg
  const activeAngleDeg = hoveredWindAngle ?? governingAngleDeg
  const activeDirection = windDirections.find((d) => d.angleDeg === activeAngleDeg)
  const activeTippingAxisIds = activeDirection?.result.tippingAxisSupportIds
  const activeTippingAxisSupports =
    (activeTippingAxisIds?.map((id) => supportById.get(id)).filter(Boolean) as Support[] | undefined) ?? []
  const hoverIsGoverning = hoveredWindAngle === null || hoveredWindAngle === governingAngleDeg

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Grundriss</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {onSupportsChange
              ? "Stützen lassen sich per Drag & Drop verschieben (Raster 0,1 m). Auf Wind-Pfeile hover'n zeigt die zugehörige Kippachse."
              : "Deklarative SVG-Draufsicht mit automatischer Skalierung."}
          </p>
        </div>
        <div className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {result ? "Mit Ergebnis" : "Unberechnet"}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="h-auto w-full select-none rounded-2xl border border-border bg-background"
      >
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
          <marker id="wind-arrow-amber" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#d97706" />
          </marker>
        </defs>

        <rect x="0" y="0" width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="url(#grid)" />

        {/* Traversen-Segmente */}
        {input.beams.map((beam) => {
          const beamSupports = getOrderedBeamSupports(beam, input.supports)
          if (beamSupports.length < 2) return null

          const first = beamSupports[0]!
          const last = beamSupports[beamSupports.length - 1]!
          const midX = (projectX(first.position.x) + projectX(last.position.x)) / 2
          const midY = (projectY(first.position.y) + projectY(last.position.y)) / 2 - 10
          const beamNearLeft = midX < 80
          const beamNearRight = midX > VIEW_WIDTH - 80
          const beamAnchor = beamNearLeft ? "start" : beamNearRight ? "end" : "middle"
          const beamLabelX = beamNearLeft ? midX + 12 : beamNearRight ? midX - 12 : midX
          const beamHeight = getBeamDisplayHeightM(beam, input.supports)
          const isLowerBeam = beam.mountHeightM !== undefined

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
                    stroke={isLowerBeam ? "#64748b" : "#334155"}
                    strokeWidth={isLowerBeam ? "3" : "4"}
                    strokeDasharray={isLowerBeam ? "7 5" : undefined}
                    strokeLinecap="round"
                  />
                )
              })}
              <text x={beamLabelX} y={midY} textAnchor={beamAnchor} className="fill-slate-700 text-[11px] font-semibold">
                {beam.label}
                {beamSupports.length > 2 ? ` (${beamSupports.length} Stützen)` : ""}
                {isLowerBeam && beamHeight !== null ? ` · ${beamHeight.toFixed(2)} m` : ""}
              </text>
            </g>
          )
        })}

        {/* Kippachse — hover beachten */}
        {activeTippingAxisSupports.length === 2 ? (
          <line
            x1={projectX(activeTippingAxisSupports[0]!.position.x)}
            y1={projectY(activeTippingAxisSupports[0]!.position.y)}
            x2={projectX(activeTippingAxisSupports[1]!.position.x)}
            y2={projectY(activeTippingAxisSupports[1]!.position.y)}
            stroke={hoverIsGoverning ? "#dc2626" : "#d97706"}
            strokeWidth="3"
            strokeDasharray="8 8"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="32"
              dur="2s"
              repeatCount="indefinite"
            />
          </line>
        ) : null}

        {/* Outrigger-Arme (gestrichelt, hinter Stützen-Circles) */}
        {input.supports.flatMap((support) => {
          const outL = support.outriggerLength ?? 0
          if (outL <= 0) return []
          const cx = projectX(support.position.x)
          const cy = projectY(support.position.y)
          // Pixel-Länge des Outriggers: Differenz zweier projizierter Weltkoordinaten
          const px = projectX(support.position.x + outL) - cx
          const tips = [
            [cx + px, cy], [cx - px, cy],
            [cx, cy + px], [cx, cy - px],
          ] as [number, number][]
          return tips.map(([tx, ty], i) => (
            <line
              key={`${support.id}-out-${i}`}
              x1={cx} y1={cy} x2={tx} y2={ty}
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
          ))
        })}

        {/* Stützen — mit Pointer-Events für Drag */}
        {input.supports.map((support) => {
          const cx = projectX(support.position.x)
          const cy = projectY(support.position.y)
          const dragging = dragRef.current?.supportId === support.id
          // Smarter Textanker: Ränder-Labels nicht clippen
          const nearLeft = cx < 80
          const nearRight = cx > VIEW_WIDTH - 80
          const labelAnchor = nearLeft ? "start" : nearRight ? "end" : "middle"
          const labelX = nearLeft ? cx + 12 : nearRight ? cx - 12 : cx
          return (
            <g
              key={support.id}
              style={onSupportsChange ? { cursor: dragging ? "grabbing" : "grab" } : undefined}
              onPointerDown={(e) => onSupportPointerDown(e, support)}
              onPointerMove={onSupportPointerMove}
              onPointerUp={onSupportPointerUp}
              onPointerCancel={onSupportPointerUp}
            >
              {/* Vergrößerter Drag-Hit-Bereich (transparent) */}
              {onSupportsChange ? (
                <circle cx={cx} cy={cy} r="16" fill="transparent" />
              ) : null}
              <circle
                cx={cx}
                cy={cy}
                r={dragging ? "10" : "8"}
                fill={supportColor(support, result)}
                stroke={dragging ? "#1e40af" : "none"}
                strokeWidth={dragging ? "2" : "0"}
              />
              <text
                x={labelX}
                y={cy - 14}
                textAnchor={labelAnchor}
                className="fill-slate-700 text-[11px] font-semibold pointer-events-none"
              >
                {support.label}
              </text>
              {dragging ? (
                <text
                  x={cx + 14}
                  y={cy + 4}
                  className="fill-blue-800 text-[10px] font-mono pointer-events-none"
                >
                  ({support.position.x.toFixed(2)}, {support.position.y.toFixed(2)})
                </text>
              ) : null}
            </g>
          )
        })}

        {/* Wind-Kompass — hover hebt zugehörige Kippachse hervor */}
        {windDirections.length > 0 && governingAngleDeg !== undefined ? (
          <g>
            {/* Wind-Info unten links, damit Kompass und Struktur-Labels nicht überlagern */}
            <text x="12" y={VIEW_HEIGHT - 20} className="fill-slate-700 text-[11px] font-semibold">
              Windrichtungen: {windDirections.map(({ angleDeg }) => getWindDirectionLabel(angleDeg)).join(", ")}
            </text>
            <text x="12" y={VIEW_HEIGHT - 7} className="fill-red-600 text-[11px] font-semibold">
              Maßgebend: {getWindDirectionDisplay(activeAngleDeg ?? governingAngleDeg)}
              {hoveredWindAngle !== null && hoveredWindAngle !== governingAngleDeg ? " (Hover)" : ""}
            </text>
            {/* Kompass oben-rechts */}
            <circle cx={COMPASS_CX} cy={COMPASS_CY} r="7" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
            {windDirections.map(({ angleDeg, result: directionResult }) => {
              const vector = compassAngleToVector(angleDeg)
              const isGoverning = angleDeg === governingAngleDeg
              const isHovered = angleDeg === hoveredWindAngle
              const stroke = isHovered ? "#d97706" : isGoverning ? "#dc2626" : "#2563eb"
              const markerId = isHovered ? "url(#wind-arrow-amber)" : isGoverning ? "url(#wind-arrow-red)" : "url(#wind-arrow-blue)"
              const strokeW = isHovered ? 4 : isGoverning ? 4 : 2.5
              const radius = isHovered ? 50 : isGoverning ? 48 : 40

              return (
                <g
                  key={angleDeg}
                  onPointerEnter={() => setHoveredWindAngle(angleDeg)}
                  onPointerLeave={() => setHoveredWindAngle(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Hit-Bereich */}
                  <circle
                    cx={COMPASS_CX + vector.x * 30}
                    cy={COMPASS_CY + vector.y * 30}
                    r="18"
                    fill="transparent"
                  />
                  <line
                    x1={COMPASS_CX + vector.x * 10}
                    y1={COMPASS_CY + vector.y * 10}
                    x2={COMPASS_CX + vector.x * radius}
                    y2={COMPASS_CY + vector.y * radius}
                    stroke={stroke}
                    strokeWidth={strokeW}
                    strokeLinecap="round"
                    markerEnd={markerId}
                  />
                  <text
                    x={COMPASS_CX + vector.x * 64}
                    y={COMPASS_CY + vector.y * 64 + 4}
                    textAnchor="middle"
                    className={
                      isHovered
                        ? "fill-amber-700 text-[11px] font-bold"
                        : isGoverning
                          ? "fill-red-600 text-[11px] font-semibold"
                          : "fill-blue-600 text-[11px] font-semibold"
                    }
                  >
                    {getWindDirectionLabel(angleDeg)}
                    {!directionResult.isOk ? " ⚠" : ""}
                  </text>
                </g>
              )
            })}

            {/* Tooltip für gehoverten Lastfall */}
            {hoveredWindAngle !== null && activeDirection ? (
              <g>
                <rect
                  x={COMPASS_CX - 225}
                  y={COMPASS_CY - 28}
                  width={210}
                  height={56}
                  rx={8}
                  fill="rgba(15, 23, 42, 0.95)"
                />
                <text x={COMPASS_CX - 215} y={COMPASS_CY - 8} className="fill-white text-[11px] font-semibold">
                  {getWindDirectionDisplay(hoveredWindAngle)}
                </text>
                <text x={COMPASS_CX - 215} y={COMPASS_CY + 8} className="fill-white text-[10px]">
                  η = {activeDirection.result.utilization.toFixed(2)}
                  {" · "}
                  Ballast {activeDirection.result.requiredBallastTotalKg.toFixed(0)} kg
                </text>
                <text x={COMPASS_CX - 215} y={COMPASS_CY + 22} className="fill-slate-300 text-[10px]">
                  {activeDirection.result.isOk ? "OK" : "kritisch"}
                </text>
              </g>
            ) : null}
          </g>
        ) : (
          <text x="24" y="28" className="fill-slate-500 text-[12px] font-semibold">
            Alle Stützen werden bis zur Berechnung neutral dargestellt.
          </text>
        )}
      </svg>

      {onSupportsChange ? (
        <p className="mt-3 text-xs text-muted-foreground">
          💡 Stützen ziehen, um Position zu ändern. Wind-Pfeile hover'n zeigt die jeweilige Kippachse.
        </p>
      ) : null}
    </section>
  )
}
