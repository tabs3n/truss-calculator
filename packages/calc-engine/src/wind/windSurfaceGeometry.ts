import type { Beam, StructureInput, Support, WindSurface } from '../types'

export interface BeamEndpointGeometry {
  start: Support
  end: Support
  startZ: number
  endZ: number
  spanM: number
  averageHeightM: number
}

function getBeamSupportIds(beam: Beam): string[] {
  return beam.supportIds && beam.supportIds.length >= 2
    ? beam.supportIds
    : [beam.startSupportId, beam.endSupportId]
}

function orderSupportsAlongAxis(supports: Support[]): Support[] {
  if (supports.length < 3) return supports

  const first = supports[0]!
  const last = supports[supports.length - 1]!
  const vx = last.position.x - first.position.x
  const vy = last.position.y - first.position.y
  const len2 = vx * vx + vy * vy
  if (len2 === 0) return supports

  const intermediates = supports.slice(1, -1).map(support => {
    const dx = support.position.x - first.position.x
    const dy = support.position.y - first.position.y
    return {
      support,
      t: (dx * vx + dy * vy) / len2,
    }
  })
  intermediates.sort((a, b) => a.t - b.t)

  return [first, ...intermediates.map(entry => entry.support), last]
}

function resolveBeamSupports(beam: Beam, supports: Support[]): Support[] {
  const resolved = getBeamSupportIds(beam)
    .map(id => supports.find(support => support.id === id))
    .filter((support): support is Support => Boolean(support))

  return orderSupportsAlongAxis(resolved)
}

export function getBeamMountHeightM(beam: Beam, support: Support): number {
  if (beam.mountHeightM === undefined) return support.height
  if (!Number.isFinite(beam.mountHeightM) || beam.mountHeightM < 0) return support.height
  return Math.min(beam.mountHeightM, support.height)
}

export function resolveBeamEndpointGeometry(
  beam: Beam,
  supports: Support[],
): BeamEndpointGeometry | null {
  const resolvedSupports = resolveBeamSupports(beam, supports)
  if (resolvedSupports.length < 2) return null

  const start = resolvedSupports[0]!
  const end = resolvedSupports[resolvedSupports.length - 1]!
  const startZ = getBeamMountHeightM(beam, start)
  const endZ = getBeamMountHeightM(beam, end)
  const spanM = Math.hypot(end.position.x - start.position.x, end.position.y - start.position.y)

  if (spanM <= 0) return null

  return {
    start,
    end,
    startZ,
    endZ,
    spanM,
    averageHeightM: (startZ + endZ) / 2,
  }
}

export function resolveWindSurfaceGeometry(
  input: StructureInput,
  topBeam: Beam,
  surface: WindSurface,
): WindSurface {
  if (surface.frameMode !== 'FILL_TRUSS_FRAME' || !surface.bottomBeamId) {
    return surface
  }

  const bottomBeam = input.beams.find(beam => beam.id === surface.bottomBeamId)
  if (!bottomBeam) return surface

  const topGeometry = resolveBeamEndpointGeometry(topBeam, input.supports)
  const bottomGeometry = resolveBeamEndpointGeometry(bottomBeam, input.supports)
  if (!topGeometry || !bottomGeometry) return surface

  const edgeInsetM = Math.max(0, surface.edgeInsetM ?? 0)
  const width = Math.min(topGeometry.spanM, bottomGeometry.spanM) - edgeInsetM * 2
  const height = topGeometry.averageHeightM - bottomGeometry.averageHeightM - edgeInsetM * 2

  if (width <= 0 || height <= 0) return surface

  return {
    ...surface,
    width,
    height,
    centerHeightAboveGround: bottomGeometry.averageHeightM + edgeInsetM + height / 2,
  }
}

export function resolveWindSurfacesForBeam(input: StructureInput, beam: Beam): WindSurface[] {
  return beam.windSurfaces.map(surface => resolveWindSurfaceGeometry(input, beam, surface))
}

export function resolveAllWindSurfaces(input: StructureInput): WindSurface[] {
  return input.beams.flatMap(beam => resolveWindSurfacesForBeam(input, beam))
}
