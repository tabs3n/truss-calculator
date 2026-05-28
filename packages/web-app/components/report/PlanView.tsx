import { Fragment } from "react"

import { getFootProperties } from "@calc-engine/materials/database"
import { Line, Path, Svg, Text } from "@react-pdf/renderer"

import { getOrderedBeamSupports, getOutriggerBackwardDir } from "@/lib/beam-helpers"
import type { Beam, CalculationResult, Support } from "@/lib/types-bridge"

/**
 * Grundriss (Draufsicht) der Konstruktion mit:
 *  - Bodenplatten / Fußabdrücken
 *  - Stützen als Punkte
 *  - Traversen-Linien zwischen Stützen
 *  - Allen Windrichtungen als Pfeile, maßgebende Richtung hervorgehoben
 *  - Kippachse des maßgebenden Lastfalls als rot gestrichelte Linie
 *
 * Ergänzt die isometrische Skizze: in der Draufsicht sieht man direkt
 * welche Stützen auf welcher Kippachse liegen.
 */

type WorldPoint = { x: number; y: number }
type ScreenPoint = { x: number; y: number }

function getFootSizeMeters(support: Support) {
  if (support.footType === "BASEPLATE") {
    const size = support.baseplateSize ?? 0.6
    return { x: size, y: size }
  }
  const props = getFootProperties(support.footType)
  return { x: props.footprintX / 1000, y: props.footprintY / 1000 }
}

function getAllBeamSupports(result: CalculationResult, beam: Beam): Support[] {
  return getOrderedBeamSupports(beam, result.input.supports)
}

function compassToWindVector(compassDeg: number): { x: number; y: number } {
  // 0° = Nord (+Y), 90° = Ost (+X). Vektor zeigt IN Windrichtung (vom Wind weg).
  const rad = (compassDeg * Math.PI) / 180
  return { x: Math.sin(rad), y: Math.cos(rad) }
}

function createClosedPath(points: ScreenPoint[]) {
  if (points.length === 0) return ""
  const [first, ...rest] = points
  return `M ${first!.x.toFixed(2)} ${first!.y.toFixed(2)} ${rest
    .map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ")} Z`
}

export function PlanView({
  result,
  width = 340,
  height = 280,
}: {
  result: CalculationResult
  width?: number
  height?: number
}) {
  const padding = 24

  // Welt-Bounding-Box aus Stützen + Fußabdrücken bestimmen
  const allWorldPoints: WorldPoint[] = []
  for (const support of result.input.supports) {
    const foot = getFootSizeMeters(support)
    allWorldPoints.push(
      { x: support.position.x - foot.x / 2, y: support.position.y - foot.y / 2 },
      { x: support.position.x + foot.x / 2, y: support.position.y + foot.y / 2 },
    )
    const outL = support.outriggerLength ?? 0
    if (outL > 0) {
      const dir = getOutriggerBackwardDir(support, result.input.beams, result.input.supports)
      const ex = support.position.x + dir.x * outL
      const ey = support.position.y + dir.y * outL
      allWorldPoints.push(
        { x: ex - foot.x / 2, y: ey - foot.y / 2 },
        { x: ex + foot.x / 2, y: ey + foot.y / 2 },
      )
    }
  }

  if (allWorldPoints.length === 0) {
    return (
      <Svg width={width} height={height}>
        <Text x={12} y={20} style={{ fontSize: 10, fill: "#64748b" }}>
          Keine Strukturdaten vorhanden.
        </Text>
      </Svg>
    )
  }

  const minX = Math.min(...allWorldPoints.map((p) => p.x))
  const maxX = Math.max(...allWorldPoints.map((p) => p.x))
  const minY = Math.min(...allWorldPoints.map((p) => p.y))
  const maxY = Math.max(...allWorldPoints.map((p) => p.y))

  // Etwas Luft um die Struktur für Wind-Pfeile
  const margin = Math.max(2, Math.max(maxX - minX, maxY - minY) * 0.35)
  const viewMinX = minX - margin
  const viewMaxX = maxX + margin
  const viewMinY = minY - margin
  const viewMaxY = maxY + margin
  const viewW = Math.max(viewMaxX - viewMinX, 1)
  const viewH = Math.max(viewMaxY - viewMinY, 1)
  const scale = Math.min((width - padding * 2) / viewW, (height - padding * 2) / viewH)

  // Welt → Screen. Achtung: Y-Achse umdrehen (oben = Nord/+Y)
  const toScreen = (p: WorldPoint): ScreenPoint => ({
    x: padding + (p.x - viewMinX) * scale,
    y: height - padding - (p.y - viewMinY) * scale,
  })

  const centerWorld: WorldPoint = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  }
  const centerScreen = toScreen(centerWorld)

  // Pfeil-Länge in Welt-Einheiten
  const arrowLengthWorld = Math.max(viewW, viewH) * 0.18

  // Kippachse des maßgebenden Lastfalls
  const tippingAxis = result.tipping.governing.tippingAxisSupportIds
    .map((id) => result.input.supports.find((s) => s.id === id))
    .filter((s): s is Support => Boolean(s))

  return (
    <Svg width={width} height={height}>
      {/* Nordpfeil oben links */}
      <Line x1={20} y1={36} x2={20} y2={14} stroke="#0f172a" strokeWidth={1.4} />
      <Path
        d={`M 20 12 L 16 20 L 24 20 Z`}
        fill="#0f172a"
      />
      <Text x={26} y={20} style={{ fontSize: 8, fill: "#0f172a" }}>
        N
      </Text>

      {/* Bodenplatten-Footprints */}
      {result.input.supports.map((support) => {
        const foot = getFootSizeMeters(support)
        const corners: WorldPoint[] = [
          { x: support.position.x - foot.x / 2, y: support.position.y - foot.y / 2 },
          { x: support.position.x + foot.x / 2, y: support.position.y - foot.y / 2 },
          { x: support.position.x + foot.x / 2, y: support.position.y + foot.y / 2 },
          { x: support.position.x - foot.x / 2, y: support.position.y + foot.y / 2 },
        ].map(toScreen)
        return (
          <Path
            key={`${support.id}-foot`}
            d={createClosedPath(corners)}
            fill={support.footType === "CONCRETE_BLOCK_1250" ? "#cbd5e1" : "#e2e8f0"}
            stroke="#94a3b8"
            strokeWidth={0.8}
          />
        )
      })}

      {/* Traversen */}
      {result.input.beams.flatMap((beam) => {
        const supports = getAllBeamSupports(result, beam)
        if (supports.length < 2) return []
        return supports.slice(0, -1).map((a, idx) => {
          const b = supports[idx + 1]!
          const pa = toScreen(a.position)
          const pb = toScreen(b.position)
          return (
            <Line
              key={`${beam.id}-${idx}`}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke={beam.mountHeightM === undefined ? "#0f172a" : "#64748b"}
              strokeWidth={beam.mountHeightM === undefined ? 1.4 : 1.1}
              strokeDasharray={beam.mountHeightM === undefined ? undefined : "4 3"}
            />
          )
        })
      })}

      {/* Outrigger-Traverse nach hinten (gestrichelt) */}
      {result.input.supports.flatMap((support) => {
        const outL = support.outriggerLength ?? 0
        if (outL <= 0) return []
        const dir = getOutriggerBackwardDir(support, result.input.beams, result.input.supports)
        const a = toScreen(support.position)
        const b = toScreen({
          x: support.position.x + dir.x * outL,
          y: support.position.y + dir.y * outL,
        })
        const foot = getFootSizeMeters(support)
        const hx = foot.x / 2
        const hy = foot.y / 2
        const ex = support.position.x + dir.x * outL
        const ey = support.position.y + dir.y * outL
        const endCorners: WorldPoint[] = [
          { x: ex - hx, y: ey - hy },
          { x: ex + hx, y: ey - hy },
          { x: ex + hx, y: ey + hy },
          { x: ex - hx, y: ey + hy },
        ]
        return [
          <Line
            key={`${support.id}-out`}
            x1={a.x} y1={a.y}
            x2={b.x} y2={b.y}
            stroke="#94a3b8"
            strokeWidth={1.4}
            strokeDasharray="5 3"
          />,
          <Path
            key={`${support.id}-out-foot`}
            d={createClosedPath(endCorners.map(toScreen))}
            fill="#e2e8f0"
            stroke="#94a3b8"
            strokeWidth={0.8}
          />,
        ]
      })}

      {/* Kippachse des maßgebenden Lastfalls (rot gestrichelt) */}
      {tippingAxis.length === 2 ? (() => {
        const pa = toScreen(tippingAxis[0]!.position)
        const pb = toScreen(tippingAxis[1]!.position)
        // Verlängere die Linie um 30 % über beide Enden für Lesbarkeit
        const dx = pb.x - pa.x
        const dy = pb.y - pa.y
        const ext = 0.3
        return (
          <Line
            x1={pa.x - dx * ext}
            y1={pa.y - dy * ext}
            x2={pb.x + dx * ext}
            y2={pb.y + dy * ext}
            stroke="#dc2626"
            strokeWidth={1.4}
            strokeDasharray="5 3"
          />
        )
      })() : null}

      {/* Stützpunkte */}
      {result.input.supports.map((support) => {
        const p = toScreen(support.position)
        return (
          <Fragment key={support.id}>
            <Path
              d={`M ${p.x} ${p.y} m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0`}
              fill="#0f172a"
            />
            <Text x={p.x + 6} y={p.y - 4} style={{ fontSize: 7, fill: "#334155" }}>
              {support.label}
            </Text>
          </Fragment>
        )
      })}

      {/* Wind-Richtungen: alle gerechneten Lastfälle als kleine Pfeile,
          maßgebende Richtung in Rot fett */}
      {result.tipping.directions.map(({ angleDeg, result: directionResult }) => {
        const vec = compassToWindVector(angleDeg)
        const isGoverning = result.tipping.governingAngleDeg === angleDeg
        // Pfeil zeigt VOM Rand der Struktur in Wind-Richtung in die Mitte (= aus dem Wind)
        const startWorld: WorldPoint = {
          x: centerWorld.x - vec.x * arrowLengthWorld * 1.6,
          y: centerWorld.y - vec.y * arrowLengthWorld * 1.6,
        }
        const endWorld: WorldPoint = {
          x: centerWorld.x - vec.x * arrowLengthWorld * 0.7,
          y: centerWorld.y - vec.y * arrowLengthWorld * 0.7,
        }
        const a = toScreen(startWorld)
        const b = toScreen(endWorld)
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.max(1, Math.hypot(dx, dy))
        const ux = dx / len
        const uy = dy / len
        const headSize = isGoverning ? 7 : 5
        const left = {
          x: b.x - ux * headSize - uy * (headSize * 0.55),
          y: b.y - uy * headSize + ux * (headSize * 0.55),
        }
        const right = {
          x: b.x - ux * headSize + uy * (headSize * 0.55),
          y: b.y - uy * headSize - ux * (headSize * 0.55),
        }
        const color = isGoverning ? "#dc2626" : "#94a3b8"
        const stroke = isGoverning ? 2 : 1
        return (
          <Fragment key={`wind-${angleDeg}`}>
            <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={stroke} />
            <Path
              d={`M ${b.x.toFixed(2)} ${b.y.toFixed(2)} L ${left.x.toFixed(2)} ${left.y.toFixed(2)} L ${right.x.toFixed(2)} ${right.y.toFixed(2)} Z`}
              fill={color}
            />
            <Text
              x={a.x - 6}
              y={a.y - 3}
              style={{
                fontSize: isGoverning ? 8 : 6.5,
                fill: color,
                fontWeight: isGoverning ? 700 : 400,
              }}
            >
              {`${angleDeg}°${directionResult.isOk ? "" : " !"}`}
            </Text>
          </Fragment>
        )
      })}

      {/* Center marker (Mitte der Konstruktion) */}
      <Path
        d={`M ${centerScreen.x} ${centerScreen.y} m -1.5 0 a 1.5 1.5 0 1 0 3 0 a 1.5 1.5 0 1 0 -3 0`}
        fill="#64748b"
      />
    </Svg>
  )
}
