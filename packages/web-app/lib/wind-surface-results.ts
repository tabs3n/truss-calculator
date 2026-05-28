import { calculateSurfaceWindForce, getDragCoefficient } from "@calc-engine/wind/windLoad"
import { resolveWindSurfacesForBeam } from "@calc-engine"

import type { CalculationResult } from "@/lib/types-bridge"

export interface WindSurfaceLoadEntry {
  beamId: string
  beamLabel: string
  surfaceId: string
  surfaceLabel: string
  directionAngleDeg: number
  dragCoefficient: number
  forceKN: number
}

export function getWindSurfaceLoadEntries(
  result: CalculationResult,
  options?: {
    beamId?: string
    directionAngleDeg?: number
  },
): WindSurfaceLoadEntry[] {
  if (result.input.environment === "INDOOR") return []

  const directionAngleDeg = options?.directionAngleDeg ?? result.tipping.governingAngleDeg
  const peakVelocityPressure = result.windLoad.peakVelocityPressure

  return result.input.beams
    .filter((beam) => !options?.beamId || beam.id === options.beamId)
    .flatMap((beam) =>
      resolveWindSurfacesForBeam(result.input, beam).map((surface) => ({
        beamId: beam.id,
        beamLabel: beam.label,
        surfaceId: surface.id,
        surfaceLabel: surface.label,
        directionAngleDeg,
        dragCoefficient: getDragCoefficient(surface),
        forceKN: calculateSurfaceWindForce(surface, directionAngleDeg, peakVelocityPressure),
      })),
    )
}
