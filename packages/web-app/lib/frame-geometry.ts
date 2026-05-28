import {
  getBeamMountHeightM,
  resolveBeamEndpointGeometry,
  resolveWindSurfaceGeometry,
} from "@calc-engine"

import { getOrderedBeamSupports } from "@/lib/beam-helpers"
import type { Beam, StructureInput, Support, WindSurface } from "@/lib/types-bridge"

export interface WorldPoint3D {
  x: number
  y: number
  z: number
}

export function getBeamDisplayHeightM(beam: Beam, supports: Support[]): number | null {
  const orderedSupports = getOrderedBeamSupports(beam, supports)
  if (orderedSupports.length === 0) return null

  const heights = orderedSupports.map((support) => getBeamMountHeightM(beam, support))
  return heights.reduce((sum, height) => sum + height, 0) / heights.length
}

export function getLowerFrameBeamOptions(
  currentBeam: Beam,
  beams: Beam[],
  supports: Support[],
): Beam[] {
  const currentGeometry = resolveBeamEndpointGeometry(currentBeam, supports)
  if (!currentGeometry) return []

  const currentIds = new Set([currentGeometry.start.id, currentGeometry.end.id])

  return beams.filter((beam) => {
    if (beam.id === currentBeam.id) return false

    const geometry = resolveBeamEndpointGeometry(beam, supports)
    if (!geometry) return false

    const candidateIds = new Set([geometry.start.id, geometry.end.id])
    const sameSupports =
      currentIds.size === candidateIds.size &&
      [...currentIds].every((id) => candidateIds.has(id))

    return sameSupports && geometry.averageHeightM < currentGeometry.averageHeightM - 0.05
  })
}

function lerp(a: number, b: number, ratio: number) {
  return a + (b - a) * ratio
}

function pointAlong(
  start: WorldPoint3D,
  end: WorldPoint3D,
  distanceM: number,
  spanM: number,
): WorldPoint3D {
  const ratio = spanM > 0 ? distanceM / spanM : 0
  return {
    x: lerp(start.x, end.x, ratio),
    y: lerp(start.y, end.y, ratio),
    z: lerp(start.z, end.z, ratio),
  }
}

function endpointPoints(beam: Beam, supports: Support[]) {
  const geometry = resolveBeamEndpointGeometry(beam, supports)
  if (!geometry) return null

  return {
    geometry,
    start: {
      x: geometry.start.position.x,
      y: geometry.start.position.y,
      z: geometry.startZ,
    },
    end: {
      x: geometry.end.position.x,
      y: geometry.end.position.y,
      z: geometry.endZ,
    },
  }
}

export function getWindSurfaceWorldCorners(
  input: StructureInput,
  topBeam: Beam,
  surface: WindSurface,
): WorldPoint3D[] | null {
  const top = endpointPoints(topBeam, input.supports)
  if (!top) return null

  const effectiveSurface = resolveWindSurfaceGeometry(input, topBeam, surface)
  const edgeInsetM = Math.max(0, surface.edgeInsetM ?? 0)

  if (surface.frameMode === "FILL_TRUSS_FRAME" && surface.bottomBeamId) {
    const bottomBeam = input.beams.find((beam) => beam.id === surface.bottomBeamId)
    const bottom = bottomBeam ? endpointPoints(bottomBeam, input.supports) : null
    if (bottom) {
      const bottomStartMatchesTopEnd = bottom.geometry.start.id === top.geometry.end.id
      const bottomEndMatchesTopStart = bottom.geometry.end.id === top.geometry.start.id
      const bottomStart = bottomStartMatchesTopEnd && bottomEndMatchesTopStart ? bottom.end : bottom.start
      const bottomEnd = bottomStartMatchesTopEnd && bottomEndMatchesTopStart ? bottom.start : bottom.end

      const topStart = pointAlong(top.start, top.end, edgeInsetM, top.geometry.spanM)
      const topEnd = pointAlong(top.start, top.end, Math.max(edgeInsetM, top.geometry.spanM - edgeInsetM), top.geometry.spanM)
      const bottomStartInset = pointAlong(bottomStart, bottomEnd, edgeInsetM, bottom.geometry.spanM)
      const bottomEndInset = pointAlong(
        bottomStart,
        bottomEnd,
        Math.max(edgeInsetM, bottom.geometry.spanM - edgeInsetM),
        bottom.geometry.spanM,
      )

      if (effectiveSurface.width > 0 && effectiveSurface.height > 0) {
        return [bottomStartInset, bottomEndInset, topEnd, topStart]
      }
    }
  }

  const spanM = top.geometry.spanM
  const surfaceWidth = Math.min(effectiveSurface.width, spanM)
  const startDistance = Math.max(0, (spanM - surfaceWidth) / 2)
  const endDistance = startDistance + surfaceWidth
  const bottomZ = Math.max(0, effectiveSurface.centerHeightAboveGround - effectiveSurface.height / 2)
  const topZ = effectiveSurface.centerHeightAboveGround + effectiveSurface.height / 2
  const startBase = pointAlong(top.start, top.end, startDistance, spanM)
  const endBase = pointAlong(top.start, top.end, endDistance, spanM)

  return [
    { ...startBase, z: bottomZ },
    { ...endBase, z: bottomZ },
    { ...endBase, z: topZ },
    { ...startBase, z: topZ },
  ]
}
