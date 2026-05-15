"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react"
import { RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getOrderedBeamSupports } from "@/lib/beam-helpers"
import { getLacingSpacingM, getTrussWidthM } from "@/lib/truss-geometry"
import type { CalculationResult, StructureInput, Support } from "@/lib/types-bridge"

/**
 * Interaktive 3D-Ansicht der Konstruktion.
 *
 * Dependency-frei: nutzt SVG mit händischer 3D-Projektion und Z-Sortierung (Painter's Algorithm).
 * Drag im Canvas → Rotation (Yaw + Pitch). Scrollrad / Buttons → Zoom.
 *
 * Rendering-Modi:
 *  "traverse" – 4 Gurtrohre + V-Lacing (realistisch)
 *  "line"     – einfache Mittellinie (schnell / Fallback)
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
  depth: number
}

// ─── Hilfst ypen ──────────────────────────────────────────────────────────────
type ScreenPt = { x: number; y: number }

/** Querschnitts-Frame einer Traverse: vier Eck-Punkte (Bottom-Left/Right, Top-Left/Right). */
type TrussFrame = { bl: ScreenPt; br: ScreenPt; tl: ScreenPt; tr: ScreenPt }

// ─── Projektion ───────────────────────────────────────────────────────────────
function makeProjector(view: ViewAngles, scale: number, cx: number, cy: number) {
  const yawRad   = (view.yaw   * Math.PI) / 180
  const pitchRad = (view.pitch * Math.PI) / 180
  const cosY = Math.cos(yawRad),  sinY = Math.sin(yawRad)
  const cosP = Math.cos(pitchRad), sinP = Math.sin(pitchRad)

  return (x: number, y: number, z: number): Projected => {
    const xr = x * cosY + y * sinY
    const yr = -x * sinY + y * cosY
    const yp = yr * cosP - z * sinP
    const zp = yr * sinP + z * cosP
    return {
      screen: { x: cx + xr * scale, y: cy - zp * scale },
      depth:  yp,
    }
  }
}

// ─── Komponente ───────────────────────────────────────────────────────────────
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

  const [view,      setView]      = useState<ViewAngles>(DEFAULT_VIEW)
  const [zoom,      setZoom]      = useState(1.0)
  const [showTruss, setShowTruss] = useState(true)   // true = Traverse, false = Linie

  // Scroll-Zoom (non-passive, damit preventDefault funktioniert)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      setZoom((z) => Math.max(0.25, Math.min(5, z * factor)))
    }
    svg.addEventListener("wheel", onWheel, { passive: false })
    return () => svg.removeEventListener("wheel", onWheel)
  }, [])

  // Bounding-Box + Auto-Skalierung
  const bbox = useMemo(() => {
    if (input.supports.length === 0) return null
    const xs      = input.supports.map((s) => s.position.x)
    const ys      = input.supports.map((s) => s.position.y)
    const heights = input.supports.map((s) => s.height)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const maxZ    = Math.max(...heights, 1)
    const cx      = (minX + maxX) / 2
    const cy      = (minY + maxY) / 2
    const sizeXY  = Math.max(maxX - minX, maxY - minY, 1)
    const size    = Math.max(sizeXY, maxZ)
    const scale   = Math.min(
      (VIEW_W - PADDING * 2) / sizeXY,
      (VIEW_H - PADDING * 2) / (size * 1.2),
    )
    return { cx, cy, scale, maxZ }
  }, [input.supports])

  const project = useMemo(() => {
    if (!bbox) return null
    return makeProjector(view, bbox.scale * zoom, VIEW_W / 2, VIEW_H / 2 + 40)
  }, [bbox, view, zoom])

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
        startX:    event.clientX,
        startY:    event.clientY,
        startYaw:  view.yaw,
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
      yaw:   (drag.startYaw + dx * 0.5) % 360,
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

  // ─── Geometrie sammeln ────────────────────────────────────────────────────
  type Renderable =
    | { kind: "ground";         depth: number; polygon: ScreenPt[] }
    | { kind: "support-column"; depth: number; support: Support; base: ScreenPt; top: ScreenPt }
    | { kind: "beam-segment";   depth: number; a: ScreenPt; b: ScreenPt; label?: string }
    | {
        kind: "beam-truss"
        depth: number
        start: TrussFrame
        end: TrussFrame
        /** Zwischenrahmen für Lacing */
        midFrames: TrussFrame[]
        label?: string
      }

  const renderables: Renderable[] = []

  /** Projiziert einen Weltpunkt (ohne localize) auf die Leinwand. */
  const pw = (wx: number, wy: number, wz: number): Projected => {
    const l = localize(wx, wy, wz)
    return project(l.x, l.y, l.z)
  }

  // Boden-Ebene
  const groundCorners = [
    { x: bbox.cx - 5, y: bbox.cy - 5 },
    { x: bbox.cx + 5, y: bbox.cy - 5 },
    { x: bbox.cx + 5, y: bbox.cy + 5 },
    { x: bbox.cx - 5, y: bbox.cy + 5 },
  ]
  const groundProjected = groundCorners.map((c) => pw(c.x, c.y, 0))
  renderables.push({
    kind:    "ground",
    depth:   Math.min(...groundProjected.map((p) => p.depth)),
    polygon: groundProjected.map((p) => p.screen),
  })

  // Stützen
  for (const support of input.supports) {
    const baseP = pw(support.position.x, support.position.y, 0)
    const topP  = pw(support.position.x, support.position.y, support.height)
    renderables.push({
      kind:    "support-column",
      depth:   (baseP.depth + topP.depth) / 2,
      support,
      base:    baseP.screen,
      top:     topP.screen,
    })
  }

  // Traversen
  for (const beam of input.beams) {
    const supports = getOrderedBeamSupports(beam, input.supports)
    for (let i = 0; i < supports.length - 1; i++) {
      const a = supports[i]!
      const b = supports[i + 1]!
      const ax = a.position.x, ay = a.position.y, az = a.height
      const bx = b.position.x, by = b.position.y, bz = b.height
      const label = i === 0 && supports.length === 2 ? beam.label : undefined

      if (!showTruss) {
        // ── Linien-Modus (Fallback) ──────────────────────────────────────
        const aP = pw(ax, ay, az)
        const bP = pw(bx, by, bz)
        renderables.push({
          kind:  "beam-segment",
          depth: (aP.depth + bP.depth) / 2,
          a:     aP.screen,
          b:     bP.screen,
          label,
        })
      } else {
        // ── Traverse-Modus: 4 Gurtrohre + V-Lacing ──────────────────────
        const dx    = bx - ax
        const dy    = by - ay
        const len2D = Math.sqrt(dx * dx + dy * dy)

        if (len2D < 0.01) {
          // Vertikales Segment (Sonderfall) → Linie
          const aP = pw(ax, ay, az)
          const bP = pw(bx, by, bz)
          renderables.push({ kind: "beam-segment", depth: (aP.depth + bP.depth) / 2, a: aP.screen, b: bP.screen, label })
          continue
        }

        const widthM  = getTrussWidthM(beam.trussType)
        const half    = widthM / 2
        // Seitenvektor: senkrecht zum Balken, in der Horizontalebene
        const sideX   = -dy / len2D
        const sideY   =  dx / len2D

        /** Projiziert einen Querschnitts-Eckpunkt:
         *  s = ±1 (Seite), u = 0 (Untergurt) / 1 (Obergurt) */
        const corner = (px: number, py: number, pz: number, s: number, u: number): Projected =>
          pw(px + sideX * s * half, py + sideY * s * half, pz + u * widthM)

        /** Erstellt einen TrussFrame (4 Eckpunkte) an einem beliebigen Streckenpunkt. */
        const makeFrame = (px: number, py: number, pz: number): TrussFrame & { avgDepth: number } => {
          const bl = corner(px, py, pz, -1, 0)
          const br = corner(px, py, pz, +1, 0)
          const tl = corner(px, py, pz, -1, 1)
          const tr = corner(px, py, pz, +1, 1)
          return {
            bl: bl.screen, br: br.screen,
            tl: tl.screen, tr: tr.screen,
            avgDepth: (bl.depth + br.depth + tl.depth + tr.depth) / 4,
          }
        }

        const startFrame = makeFrame(ax, ay, az)
        const endFrame   = makeFrame(bx, by, bz)

        // Zwischenrahmen für Lacing
        const beamLen3D = Math.sqrt(dx * dx + dy * dy + (bz - az) ** 2)
        const lacingSpc  = getLacingSpacingM(widthM)
        const nSections  = Math.max(1, Math.round(beamLen3D / lacingSpc))
        const midFrames: TrussFrame[] = []
        for (let k = 1; k < nSections; k++) {
          const t  = k / nSections
          midFrames.push(makeFrame(ax + t * dx, ay + t * dy, az + t * (bz - az)))
        }

        renderables.push({
          kind:      "beam-truss",
          depth:     (startFrame.avgDepth + endFrame.avgDepth) / 2,
          start:     startFrame,
          end:       endFrame,
          midFrames,
          label,
        })
      }
    }
  }

  // Painter's algorithm: hinten zuerst
  renderables.sort((a, b) => b.depth - a.depth)

  const supportColor = (s: Support) => {
    if (!result) return "#94a3b8"
    const sr = result.supports.find((x) => x.supportId === s.id)
    if (!sr) return "#94a3b8"
    return sr.isOk ? "#16a34a" : "#dc2626"
  }

  // ─── JSX ─────────────────────────────────────────────────────────────────
  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">3D-Ansicht</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ziehen = Drehen · Scrollen = Zoom · {Math.round(zoom * 100)} %
            &nbsp;·&nbsp;Yaw {view.yaw.toFixed(0)}° / Pitch {view.pitch.toFixed(0)}°
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {/* Darstellungs-Toggle */}
          <Button
            type="button"
            variant={showTruss ? "default" : "outline"}
            size="sm"
            onClick={() => setShowTruss((v) => !v)}
            className="h-9 px-3 text-xs font-semibold"
            title={showTruss ? "Zu Linien-Ansicht wechseln" : "Zu Traverse-Ansicht wechseln"}
          >
            {showTruss ? "Traverse" : "Linie"}
          </Button>
          {/* Zoom */}
          <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0 text-base font-bold" title="Reinzoomen"  onClick={() => setZoom((z) => Math.min(5, z * 1.25))}>+</Button>
          <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0 text-base font-bold" title="Rauszoomen" onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))}>−</Button>
          {/* Reset */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { setView(DEFAULT_VIEW); setZoom(1) }}
            className="h-9 px-3"
            title="Ansicht zurücksetzen"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
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

          // ── Boden ──────────────────────────────────────────────────────
          if (r.kind === "ground") {
            const path = r.polygon
              .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
              .join(" ") + " Z"
            return <path key={`g-${idx}`} d={path} fill="rgba(241,245,249,0.6)" stroke="#cbd5e1" strokeWidth={0.5} />
          }

          // ── Stütze ─────────────────────────────────────────────────────
          if (r.kind === "support-column") {
            return (
              <g key={`s-${r.support.id}-${idx}`}>
                <line x1={r.base.x} y1={r.base.y} x2={r.top.x} y2={r.top.y}
                  stroke={supportColor(r.support)} strokeWidth={5} strokeLinecap="round" />
                <circle cx={r.base.x} cy={r.base.y} r={4} fill="#475569" />
                <text x={r.top.x + 6} y={r.top.y - 4}
                  className="fill-slate-700 text-[10px] font-semibold pointer-events-none">
                  {r.support.label}
                </text>
              </g>
            )
          }

          // ── Traverse-Linie (Fallback) ──────────────────────────────────
          if (r.kind === "beam-segment") {
            return (
              <g key={`bl-${idx}`}>
                <line x1={r.a.x} y1={r.a.y} x2={r.b.x} y2={r.b.y}
                  stroke="#0f172a" strokeWidth={4} strokeLinecap="round" />
                {r.label ? (
                  <text x={(r.a.x + r.b.x) / 2} y={(r.a.y + r.b.y) / 2 - 8}
                    textAnchor="middle"
                    className="fill-slate-700 text-[10px] font-semibold pointer-events-none">
                    {r.label}
                  </text>
                ) : null}
              </g>
            )
          }

          // ── Traverse-Geometrie ─────────────────────────────────────────
          if (r.kind === "beam-truss") {
            const allFrames = [r.start, ...r.midFrames, r.end]
            const C = "#0f172a"   // Gurtrohr-Farbe
            const L = "#475569"   // Lacing-Farbe

            // Polyline-Punkte für die 4 Gurtrohre
            const pts = (key: keyof TrussFrame) =>
              allFrames.map((f) => `${f[key].x.toFixed(1)},${f[key].y.toFixed(1)}`).join(" ")

            // Deckfläche (oben, semi-transparent, für räumlichen Eindruck)
            const topFace = [
              ...allFrames.map((f) => `${f.tl.x.toFixed(1)},${f.tl.y.toFixed(1)}`),
              ...[...allFrames].reverse().map((f) => `${f.tr.x.toFixed(1)},${f.tr.y.toFixed(1)}`),
            ].join(" ")

            // Endrahmen als Polygon-Punkte
            const framePts = (f: TrussFrame) =>
              `${f.bl.x.toFixed(1)},${f.bl.y.toFixed(1)} ${f.br.x.toFixed(1)},${f.br.y.toFixed(1)} ${f.tr.x.toFixed(1)},${f.tr.y.toFixed(1)} ${f.tl.x.toFixed(1)},${f.tl.y.toFixed(1)}`

            // Label-Mittelpunkt oben
            const lx = (r.start.tl.x + r.start.tr.x + r.end.tl.x + r.end.tr.x) / 4
            const ly = (r.start.tl.y + r.start.tr.y + r.end.tl.y + r.end.tr.y) / 4 - 8

            return (
              <g key={`bt-${idx}`}>
                {/* Deckfläche */}
                <polygon points={topFace} fill="rgba(15,23,42,0.08)" stroke="none" />

                {/* 4 Gurtrohre */}
                <polyline points={pts("bl")} fill="none" stroke={C} strokeWidth={2} strokeLinecap="round" />
                <polyline points={pts("br")} fill="none" stroke={C} strokeWidth={2} strokeLinecap="round" />
                <polyline points={pts("tl")} fill="none" stroke={C} strokeWidth={2} strokeLinecap="round" />
                <polyline points={pts("tr")} fill="none" stroke={C} strokeWidth={2} strokeLinecap="round" />

                {/* Endrahmen */}
                <polygon points={framePts(r.start)} fill="rgba(15,23,42,0.06)" stroke={C} strokeWidth={1.5} />
                <polygon points={framePts(r.end)}   fill="rgba(15,23,42,0.06)" stroke={C} strokeWidth={1.5} />

                {/* Zwischenrahmen + V-Lacing */}
                {allFrames.slice(0, -1).map((frame, fi) => {
                  const next = allFrames[fi + 1]!
                  // Alternierend: gerader Index → Diagonal von unten nach oben vorwärts
                  //               ungerader Index → Diagonal von oben nach unten vorwärts
                  return (
                    <g key={fi}>
                      {fi % 2 === 0 ? (
                        <>
                          <line x1={frame.bl.x} y1={frame.bl.y} x2={next.tr.x} y2={next.tr.y} stroke={L} strokeWidth={1} opacity={0.55} />
                          <line x1={frame.br.x} y1={frame.br.y} x2={next.tl.x} y2={next.tl.y} stroke={L} strokeWidth={1} opacity={0.55} />
                        </>
                      ) : (
                        <>
                          <line x1={frame.tl.x} y1={frame.tl.y} x2={next.br.x} y2={next.br.y} stroke={L} strokeWidth={1} opacity={0.55} />
                          <line x1={frame.tr.x} y1={frame.tr.y} x2={next.bl.x} y2={next.bl.y} stroke={L} strokeWidth={1} opacity={0.55} />
                        </>
                      )}
                      {/* Zwischenrahmen (nicht Start/End) */}
                      {fi > 0 ? (
                        <polygon
                          points={framePts(frame)}
                          fill="none" stroke="#64748b" strokeWidth={0.8} opacity={0.45}
                        />
                      ) : null}
                    </g>
                  )
                })}

                {r.label ? (
                  <text x={lx} y={ly} textAnchor="middle"
                    className="fill-slate-700 text-[10px] font-semibold pointer-events-none">
                    {r.label}
                  </text>
                ) : null}
              </g>
            )
          }

          return null
        })}

        {/* Achsen-Marker unten rechts */}
        <g transform={`translate(${VIEW_W - 60} ${VIEW_H - 60})`}>
          {(() => {
            const axisLen = 30
            const xAxis   = project(axisLen, 0, 0)
            const yAxis   = project(0, axisLen, 0)
            const zAxis   = project(0, 0, axisLen)
            const origin  = project(0, 0, 0)
            const lp = (p: Projected) => ({
              x: p.screen.x - origin.screen.x,
              y: p.screen.y - origin.screen.y,
            })
            const xp = lp(xAxis), yp = lp(yAxis), zp = lp(zAxis)
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
        💡 Drag = Drehen (Yaw / Pitch) · Scrollrad oder ± = Zoomen ·{" "}
        <strong>Traverse</strong> zeigt 4 Gurtrohre + V-Lacing · <strong>Linie</strong> = einfache Ansicht.
      </p>
    </section>
  )
}
