import { Fragment } from "react"

import { getBeamMountHeightM } from "@calc-engine"
import { getFootProperties, getTrussProperties } from "@calc-engine/materials/database"
import { Line, Path, Svg, Text } from "@react-pdf/renderer"

import { getOrderedBeamSupports } from "@/lib/beam-helpers"
import { getWindSurfaceWorldCorners } from "@/lib/frame-geometry"
import type { Beam, CalculationResult, Support } from "@/lib/types-bridge"

const COS_30 = Math.cos(Math.PI / 6)
const SIN_30 = Math.sin(Math.PI / 6)

type WorldPoint = {
  x: number
  y: number
  z: number
}

type ScreenPoint = {
  x: number
  y: number
}

function projectUnitIso(point: WorldPoint): ScreenPoint {
  return {
    x: (point.x - point.y) * COS_30,
    y: (point.x + point.y) * SIN_30 - point.z,
  }
}

function createClosedPath(points: ScreenPoint[]) {
  if (points.length === 0) return ""

  const [first, ...rest] = points
  return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} ${rest
    .map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ")} Z`
}

function getFootSizeMeters(support: Support) {
  if (support.footType === "BASEPLATE") {
    const size = support.baseplateSize ?? 0.6
    return { x: size, y: size }
  }

  const properties = getFootProperties(support.footType)
  return {
    x: properties.footprintX / 1000,
    y: properties.footprintY / 1000,
  }
}

/**
 * Liefert alle Stützen einer Traverse in physikalisch korrekter Reihenfolge
 * (sortiert nach Projektion auf Start→Ende-Vektor).
 */
function getAllBeamSupports(result: CalculationResult, beam: Beam): Support[] {
  return getOrderedBeamSupports(beam, result.input.supports)
}

function interpolateBeamPoint(beam: Beam, result: CalculationResult, distanceM: number): WorldPoint | null {
  const supports = getAllBeamSupports(result, beam)
  if (supports.length < 2) return null

  // Multi-Support: Position entlang der Polylinie aller Stützpunkte ermitteln
  let accumulated = 0
  for (let i = 0; i < supports.length - 1; i++) {
    const a = supports[i]!
    const b = supports[i + 1]!
    const segLength = Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y)
    if (distanceM <= accumulated + segLength || i === supports.length - 2) {
      const localDistance = distanceM - accumulated
      const ratio = segLength > 0 ? localDistance / segLength : 0
      return {
        x: a.position.x + (b.position.x - a.position.x) * ratio,
        y: a.position.y + (b.position.y - a.position.y) * ratio,
        z: getBeamMountHeightM(beam, a) + (getBeamMountHeightM(beam, b) - getBeamMountHeightM(beam, a)) * ratio,
      }
    }
    accumulated += segLength
  }

  // Fallback (unreachable, da der Loop oben immer returnt wenn supports.length>=2)
  const startSupport = supports[0]!
  const endSupport = supports[supports.length - 1]!
  const deltaX = endSupport.position.x - startSupport.position.x
  const deltaY = endSupport.position.y - startSupport.position.y
  const span = Math.hypot(deltaX, deltaY)
  const ratio = span > 0 ? distanceM / span : 0

  return {
    x: startSupport.position.x + deltaX * ratio,
    y: startSupport.position.y + deltaY * ratio,
    z: getBeamMountHeightM(beam, startSupport) +
      (getBeamMountHeightM(beam, endSupport) - getBeamMountHeightM(beam, startSupport)) * ratio,
  }
}

function getWindVectorWorld(angleDeg: number) {
  const radians = (angleDeg * Math.PI) / 180
  return {
    x: Math.sin(radians),
    y: Math.cos(radians),
  }
}

export function IsometricSketch({
  result,
  width = 340,
  height = 227,
}: {
  result: CalculationResult
  width?: number
  height?: number
}) {
  const padding = 18
  const maxHeight = Math.max(...result.input.supports.map((support) => support.height), 1)

  const footprintPoints = result.input.supports.flatMap((support) => {
    const footSize = getFootSizeMeters(support)
    const halfX = footSize.x / 2
    const halfY = footSize.y / 2

    return [
      { x: support.position.x - halfX, y: support.position.y - halfY, z: 0 },
      { x: support.position.x + halfX, y: support.position.y - halfY, z: 0 },
      { x: support.position.x + halfX, y: support.position.y + halfY, z: 0 },
      { x: support.position.x - halfX, y: support.position.y + halfY, z: 0 },
    ]
  })

  const supportPoints = result.input.supports.flatMap((support) => [
    { x: support.position.x, y: support.position.y, z: 0 },
    { x: support.position.x, y: support.position.y, z: support.height },
  ])

  const beamPoints = result.input.beams.flatMap((beam) => {
    const beamSupports = getAllBeamSupports(result, beam)
    if (beamSupports.length < 2) return []

    return beamSupports.map((support) => ({
      x: support.position.x,
      y: support.position.y,
      z: getBeamMountHeightM(beam, support),
    }))
  })

  const windSurfacePoints = result.input.beams.flatMap((beam) => {
    return beam.windSurfaces.flatMap((surface) => getWindSurfaceWorldCorners(result.input, beam, surface) ?? [])
  })

  const windVector = getWindVectorWorld(result.tipping.governingAngleDeg)
  const centerX =
    result.input.supports.reduce((sum, support) => sum + support.position.x, 0) /
    Math.max(result.input.supports.length, 1)
  const centerY =
    result.input.supports.reduce((sum, support) => sum + support.position.y, 0) /
    Math.max(result.input.supports.length, 1)
  const arrowPoints = [
    { x: centerX - windVector.x * 2.8, y: centerY - windVector.y * 2.8, z: maxHeight + 1.2 },
    { x: centerX - windVector.x * 0.8, y: centerY - windVector.y * 0.8, z: maxHeight + 0.6 },
  ]

  const allWorldPoints = [
    ...footprintPoints,
    ...supportPoints,
    ...beamPoints,
    ...windSurfacePoints,
    ...arrowPoints,
  ]

  if (allWorldPoints.length === 0) {
    return (
      <Svg width={width} height={height}>
        <Text x={12} y={20} style={{ fontSize: 10, fill: "#64748b" }}>
          Keine Strukturdaten vorhanden.
        </Text>
      </Svg>
    )
  }

  const projectedPoints = allWorldPoints.map(projectUnitIso)
  const minX = Math.min(...projectedPoints.map((point) => point.x))
  const maxX = Math.max(...projectedPoints.map((point) => point.x))
  const minY = Math.min(...projectedPoints.map((point) => point.y))
  const maxY = Math.max(...projectedPoints.map((point) => point.y))
  const unitWidth = Math.max(maxX - minX, 1)
  const unitHeight = Math.max(maxY - minY, 1)
  const scale = Math.min((width - padding * 2) / unitWidth, (height - padding * 2) / unitHeight)

  const toScreen = (point: WorldPoint): ScreenPoint => {
    const projected = projectUnitIso(point)
    return {
      x: padding + (projected.x - minX) * scale,
      y: padding + (projected.y - minY) * scale,
    }
  }

  const tippingAxisSupports = result.tipping.governing.tippingAxisSupportIds
    .map((id) => result.input.supports.find((support) => support.id === id))
    .filter((support): support is Support => Boolean(support))

  const arrowStart = toScreen(arrowPoints[0]!)
  const arrowEnd = toScreen(arrowPoints[1]!)
  const arrowVector = {
    x: arrowEnd.x - arrowStart.x,
    y: arrowEnd.y - arrowStart.y,
  }
  const arrowLength = Math.max(Math.hypot(arrowVector.x, arrowVector.y), 1)
  const arrowUnit = {
    x: arrowVector.x / arrowLength,
    y: arrowVector.y / arrowLength,
  }
  const arrowHeadSize = 7
  const arrowLeft = {
    x: arrowEnd.x - arrowUnit.x * arrowHeadSize - arrowUnit.y * (arrowHeadSize * 0.6),
    y: arrowEnd.y - arrowUnit.y * arrowHeadSize + arrowUnit.x * (arrowHeadSize * 0.6),
  }
  const arrowRight = {
    x: arrowEnd.x - arrowUnit.x * arrowHeadSize + arrowUnit.y * (arrowHeadSize * 0.6),
    y: arrowEnd.y - arrowUnit.y * arrowHeadSize - arrowUnit.x * (arrowHeadSize * 0.6),
  }

  return (
    <Svg width={width} height={height}>
      {result.input.supports.map((support) => {
        const footSize = getFootSizeMeters(support)
        const halfX = footSize.x / 2
        const halfY = footSize.y / 2
        const footprint = [
          toScreen({ x: support.position.x - halfX, y: support.position.y - halfY, z: 0 }),
          toScreen({ x: support.position.x + halfX, y: support.position.y - halfY, z: 0 }),
          toScreen({ x: support.position.x + halfX, y: support.position.y + halfY, z: 0 }),
          toScreen({ x: support.position.x - halfX, y: support.position.y + halfY, z: 0 }),
        ]

        return (
          <Path
            key={`${support.id}-foot`}
            d={createClosedPath(footprint)}
            fill={support.footType === "CONCRETE_BLOCK_1250" ? "#cbd5e1" : "#e2e8f0"}
            stroke="#94a3b8"
            strokeWidth={1}
          />
        )
      })}

      {result.input.beams.flatMap((beam) => {
        const beamSupports = getAllBeamSupports(result, beam)
        if (beamSupports.length < 2) return []

        const strokeWidth = Math.max(1.2, Math.min(3.8, getTrussProperties(beam.trussType).weightPerMeter * 0.35))

        // Multi-Support: zeichne Linie zwischen jeweils zwei aufeinanderfolgenden Stützen
        return beamSupports.slice(0, -1).map((startSupport, index) => {
          const endSupport = beamSupports[index + 1]!
          const startPoint = toScreen({
            x: startSupport.position.x,
            y: startSupport.position.y,
            z: getBeamMountHeightM(beam, startSupport),
          })
          const endPoint = toScreen({
            x: endSupport.position.x,
            y: endSupport.position.y,
            z: getBeamMountHeightM(beam, endSupport),
          })
          return (
            <Line
              key={`${beam.id}-seg-${index}`}
              x1={startPoint.x}
              y1={startPoint.y}
              x2={endPoint.x}
              y2={endPoint.y}
              stroke="#0f172a"
              strokeWidth={strokeWidth}
            />
          )
        })
      })}

      {result.input.beams.flatMap((beam) => {
        return beam.windSurfaces.map((surface) => {
          const corners = getWindSurfaceWorldCorners(result.input, beam, surface)
          if (!corners) return null
          const polygon = corners.map(toScreen)

          return (
            <Path
              key={surface.id}
              d={createClosedPath(polygon)}
              fill="#bfdbfe"
              stroke="#60a5fa"
              strokeWidth={1}
            />
          )
        })
      })}

      {result.input.supports.map((support) => {
        const basePoint = toScreen({ x: support.position.x, y: support.position.y, z: 0 })
        const topPoint = toScreen({ x: support.position.x, y: support.position.y, z: support.height })
        const strokeWidth = Math.max(1.2, Math.min(3.6, getTrussProperties(support.trussType).weightPerMeter * 0.32))

        return (
          <Fragment key={support.id}>
            <Line
              x1={basePoint.x}
              y1={basePoint.y}
              x2={topPoint.x}
              y2={topPoint.y}
              stroke="#1e293b"
              strokeWidth={strokeWidth}
            />
            <Text x={topPoint.x + 4} y={topPoint.y - 4} style={{ fontSize: 7, fill: "#334155" }}>
              {support.label}
            </Text>
          </Fragment>
        )
      })}

      {result.input.beams.flatMap((beam) =>
        beam.loads.map((load) => {
          const loadPoint = interpolateBeamPoint(beam, result, load.positionAlongBeam)
          if (!loadPoint) return null

          const topPoint = toScreen(loadPoint)
          const triangle = [
            { x: topPoint.x, y: topPoint.y + 5 },
            { x: topPoint.x - 4, y: topPoint.y + 11 },
            { x: topPoint.x + 4, y: topPoint.y + 11 },
          ]

          return (
            <Fragment key={load.id}>
              <Path d={createClosedPath(triangle)} fill="#1d4ed8" stroke="#1d4ed8" strokeWidth={0.8} />
              <Text x={topPoint.x + 6} y={topPoint.y + 10} style={{ fontSize: 6.5, fill: "#1e293b" }}>
                {load.label}
              </Text>
            </Fragment>
          )
        }),
      )}

      {tippingAxisSupports.length === 2 ? (
        <Line
          x1={toScreen({ x: tippingAxisSupports[0].position.x, y: tippingAxisSupports[0].position.y, z: 0 }).x}
          y1={toScreen({ x: tippingAxisSupports[0].position.x, y: tippingAxisSupports[0].position.y, z: 0 }).y}
          x2={toScreen({ x: tippingAxisSupports[1].position.x, y: tippingAxisSupports[1].position.y, z: 0 }).x}
          y2={toScreen({ x: tippingAxisSupports[1].position.x, y: tippingAxisSupports[1].position.y, z: 0 }).y}
          stroke="#dc2626"
          strokeWidth={1.2}
          strokeDasharray="5 4"
        />
      ) : null}

      <Line
        x1={arrowStart.x}
        y1={arrowStart.y}
        x2={arrowEnd.x}
        y2={arrowEnd.y}
        stroke="#dc2626"
        strokeWidth={2}
      />
      <Path
        d={`M ${arrowEnd.x.toFixed(2)} ${arrowEnd.y.toFixed(2)} L ${arrowLeft.x.toFixed(2)} ${arrowLeft.y.toFixed(2)} L ${arrowRight.x.toFixed(2)} ${arrowRight.y.toFixed(2)} Z`}
        fill="#dc2626"
      />
      <Text x={arrowStart.x - 8} y={arrowStart.y - 4} style={{ fontSize: 7, fill: "#dc2626" }}>
        Wind {result.tipping.governingAngleDeg}°
      </Text>
    </Svg>
  )
}
