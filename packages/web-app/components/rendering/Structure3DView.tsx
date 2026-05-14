"use client"

import { useCallback, useMemo, useRef, useState, type PointerEvent } from "react"
import { RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getOrderedBeamSupports } from "@/lib/beam-helpers"
import type { CalculationResult, StructureInput, Support } from "@/lib/types-bridge"

/**
 * Interaktive 3D-Ansicht der Konstruktion.
 *
 * Dependency-frei: nutzt SVG mit händischer 3D-Projektion und Z-Sortierung.
 * Drag im Canvas → Rotation um vertikale Achse + Kippung.
 *
 * Welt-Koordinaten:
 *  X = nach Osten (rechts)
 *  Y = nach Norden (hinten in der Default-Ansicht)
 *  Z = nach oben
 */

const VIEW_W = 500
const VIEW_H = 400
const PADDING = 40

interface ViewAngles {
  /** Rotation um Z (Yaw) in Grad. 0 = Blick nach Norden. */
  yaw: number
  /** Neigung (Pitch) in Grad. 30 = leicht von oben. */
  pitch: number
}

const DEFAULT_VIEW: ViewAngles = { yaw: 30, pitch: 25 }

interface Projected {
  screen: { x: number; y: number }
  depth: number  // für Z-Sortierung
}

function makeProjector(view: ViewAngles, scale: number, cx: number, cy: number) {
  const yawRad = (view.yaw * Math.PI) / 180
  const pitchRad = (view.pitch * Math.PI) / 180
  const cosY = Math.cos(yawRad)
  const sinY = Math.sin(yawRad)
  const cosP = Math.cos(pitchRad)
  const sinP = Math.sin(pitchRad)

  return (x: number, y: number, z: number): Projected => {
    // Yaw: Welt-X/Y um Z-Achse drehen
    const xr = x * cosY + y * sinY
    const yr = -x * sinY + y * cosY
    // Pitch: Yr/Z um X-Achse drehen
    const yp = yr * cosP - z * sinP
    const zp = yr * sinP + z * cosP
    return {
      screen: {
        x: cx + xr * scale,
        y: cy - zp * scale,
      },
      depth: yp,
    }
  }
}

export function Structure3DView({
  input,
  result,
}: {
  input: StructureInput
  result: CalculationResult | null
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startYaw: number
    startPitch: number
  } | null>(null)

  const [view, setView] = useState<ViewAngles>(DEFAULT_VIEW)

  // Bounding-Box + Auto-Skalierung
  const bbox = useMemo(() => {
    if (input.supports.length === 0) return null
    const xs = input.supports.map((s) => s.position.x)
    const ys = input.supports.map((s) => s.position.y)
    const heights = input.supports.map((s) => s.height)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const maxZ = Math.max(...heights, 1)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const sizeXY = Math.max(maxX - minX, maxY - minY, 1)
    const size = Math.max(sizeXY, maxZ)
    const scale = Math.min((VIEW_W - PADDING * 2) / sizeXY, (VIEW_H - PADDING * 2) / (size * 1.2))
    return { cx, cy, scale, maxZ }
  }, [input.supports])

  const project = useMemo(() => {
    if (!bbox) return null
    return makeProjector(view, bbox.scale, VIEW_W / 2, VIEW_H / 2 + 40)
  }, [bbox, view])

  // Translation in Welt-Koordinaten so dass Schwerpunkt im Ursprung steht
  const localize = useCallback(
    (x: number, y: number, z: number) => {
      if (!bbox) return { x, y, z }
      return { x: x - bbox.cx, y: y - bbox.cy, z }
    },
    [bbox],
  )

  // Drag-Rotation
  const onPointerDown = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startYaw: view.yaw,
        startPitch: view.pitch,
      }
    },
    [view],
  )

  const onPointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    setView({
      yaw: (drag.startYaw + dx * 0.5) % 360,
      pitch: Math.max(5, Math.min(80, drag.startPitch + dy * 0.5)),
    })
  }, [])

  const onPointerUp = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    ;(event.currentTarget as Element).releasePointerCapture?.(event.pointerId)
    dragRef.current = null
  }, [])

  if (!bbox || !project || input.supports.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-card/90 p-6 text-sm text-muted-foreground">
        Noch keine Geometrie für 3D-Ansicht.
      </div>
    )
  }

  // ─── Geometrie sammeln und nach Tiefe sortieren ───────────────────────
  type Renderable =
    | {
        kind: "ground"
        depth: number
        polygon: Array<{ x: number; y: number }>
      }
    | {
        kind: "support-column"
        depth: number
        support: Support
        base: { x: number; y: number }
        top: { x: number; y: number }
      }
    | {
        kind: "beam-segment"
        depth: number
        a: { x: number; y: number }
        b: { x: number; y: number }
        label?: string
      }

  const renderables: Renderable[] = []

  // Boden-Ebene als großes Rechteck (transparent)
  const groundCorners = [
    { x: bbox.cx - 5, y: bbox.cy - 5 },
    { x: bbox.cx + 5, y: bbox.cy - 5 },
    { x: bbox.cx + 5, y: bbox.cy + 5 },
    { x: bbox.cx - 5, y: bbox.cy + 5 },
  ]
  const groundProjected = groundCorners.map((c) => {
    const l = localize(c.x, c.y, 0)
    return project(l.x, l.y, 0)
  })
  renderables.push({
    kind: "ground",
    depth: Math.min(...groundProjected.map((p) => p.depth)),
    polygon: groundProjected.map((p) => p.screen),
  })

  // Stützen
  for (const support of input.supports) {
    const baseL = localize(support.position.x, support.position.y, 0)
    const topL = localize(support.position.x, support.position.y, support.height)
    const baseP = project(baseL.x, baseL.y, baseL.z)
    const topP = project(topL.x, topL.y, topL.z)
    renderables.push({
      kind: "support-column",
      depth: (baseP.depth + topP.depth) / 2,
      support,
      base: baseP.screen,
      top: topP.screen,
    })
  }

  // Traversen-Segmente
  for (const beam of input.beams) {
    const supports = getOrderedBeamSupports(beam, input.supports)
    for (let i = 0; i < supports.length - 1; i++) {
      const a = supports[i]!
      const b = supports[i + 1]!
      const aL = localize(a.position.x, a.position.y, a.height)
      const bL = localize(b.position.x, b.position.y, b.height)
      const aP = project(aL.x, aL.y, aL.z)
      const bP = project(bL.x, bL.y, bL.z)
      renderables.push({
        kind: "beam-segment",
        depth: (aP.depth + bP.depth) / 2,
        a: aP.screen,
        b: bP.screen,
        label: i === 0 && supports.length === 2 ? beam.label : undefined,
      })
    }
  }

  // Painter's algorithm: hintere zuerst (tiefer = größere `depth`)
  renderables.sort((a, b) => b.depth - a.depth)

  const supportColor = (s: Support) => {
    if (!result) return "#94a3b8"
    const sr = result.supports.find((x) => x.supportId === s.id)
    if (!sr) return "#94a3b8"
    return sr.isOk ? "#16a34a" : "#dc2626"
  }

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">3D-Ansicht</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ziehen zum Drehen. Yaw {view.yaw.toFixed(0)}° / Pitch {view.pitch.toFixed(0)}°.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setView(DEFAULT_VIEW)}
          className="h-9"
          title="Ansicht zurücksetzen"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full cursor-grab select-none rounded-2xl border border-border bg-background touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
      >
        <defs>
          <pattern id="grid3d" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(148, 163, 184, 0.12)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#grid3d)" />

        {renderables.map((r, idx) => {
          if (r.kind === "ground") {
            const path = r.polygon
              .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
              .join(" ") + " Z"
            return <path key={`g-${idx}`} d={path} fill="rgba(241, 245, 249, 0.6)" stroke="#cbd5e1" strokeWidth={0.5} />
          }
          if (r.kind === "support-column") {
            return (
              <g key={`s-${r.support.id}-${idx}`}>
                <line
                  x1={r.base.x}
                  y1={r.base.y}
                  x2={r.top.x}
                  y2={r.top.y}
                  stroke={supportColor(r.support)}
                  strokeWidth={5}
                  strokeLinecap="round"
                />
                <circle cx={r.base.x} cy={r.base.y} r={4} fill="#475569" />
                <text
                  x={r.top.x + 6}
                  y={r.top.y - 4}
                  className="fill-slate-700 text-[10px] font-semibold pointer-events-none"
                >
                  {r.support.label}
                </text>
              </g>
            )
          }
          if (r.kind === "beam-segment") {
            return (
              <g key={`b-${idx}`}>
                <line
                  x1={r.a.x}
                  y1={r.a.y}
                  x2={r.b.x}
                  y2={r.b.y}
                  stroke="#0f172a"
                  strokeWidth={4}
                  strokeLinecap="round"
                />
                {r.label ? (
                  <text
                    x={(r.a.x + r.b.x) / 2}
                    y={(r.a.y + r.b.y) / 2 - 8}
                    textAnchor="middle"
                    className="fill-slate-700 text-[10px] font-semibold pointer-events-none"
                  >
                    {r.label}
                  </text>
                ) : null}
              </g>
            )
          }
          return null
        })}

        {/* Achsen-Marker oben rechts */}
        <g transform={`translate(${VIEW_W - 60} ${VIEW_H - 60})`}>
          {(() => {
            const axisLen = 30
            const xAxis = project(axisLen, 0, 0)
            const yAxis = project(0, axisLen, 0)
            const zAxis = project(0, 0, axisLen)
            const origin = project(0, 0, 0)
            const localProject = (proj: Projected) => ({
              x: proj.screen.x - origin.screen.x,
              y: proj.screen.y - origin.screen.y,
            })
            const xp = localProject(xAxis)
            const yp = localProject(yAxis)
            const zp = localProject(zAxis)
            return (
              <>
                <line x1={0} y1={0} x2={xp.x} y2={xp.y} stroke="#dc2626" strokeWidth={2} />
                <text x={xp.x + 4} y={xp.y + 4} className="fill-red-600 text-[10px] font-bold">X (Ost)</text>
                <line x1={0} y1={0} x2={yp.x} y2={yp.y} stroke="#16a34a" strokeWidth={2} />
                <text x={yp.x + 4} y={yp.y + 4} className="fill-emerald-600 text-[10px] font-bold">Y (Nord)</text>
                <line x1={0} y1={0} x2={zp.x} y2={zp.y} stroke="#2563eb" strokeWidth={2} />
                <text x={zp.x + 4} y={zp.y + 4} className="fill-blue-600 text-[10px] font-bold">Z</text>
              </>
            )
          })()}
        </g>
      </svg>

      <p className="mt-3 text-xs text-muted-foreground">
        💡 Drag im Canvas zum Drehen. Horizontal = Yaw (Drehung um Z), Vertikal = Pitch (Neigung).
      </p>
    </section>
  )
}
