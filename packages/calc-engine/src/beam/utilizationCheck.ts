import type { TrussType } from '../types.js'
import { getTrussProperties } from '../materials/database.js'
import type { BeamInternalForces } from './beamCalculation.js'

export interface UtilizationResult {
  bendingUtilization: number   // η = MEd / MRd
  shearUtilization: number     // η = VEd / VRd
  isOk: boolean
  failureReason?: string
}

/** Tragfähigkeitsnachweis Traverse nach DIN EN 1999-1-1 (EC9) */
export function checkBeamUtilization(
  trussType: TrussType,
  internalForces: BeamInternalForces,
): UtilizationResult {
  const props = getTrussProperties(trussType)

  const bendingUtilization = internalForces.maxBendingMomentKNm / props.bendingResistanceY
  const shearUtilization = internalForces.maxShearForceKN / props.shearResistanceZ

  const failures: string[] = []
  if (bendingUtilization > 1.0) {
    failures.push(`Biegung: η=${bendingUtilization.toFixed(2)} > 1.0`)
  }
  if (shearUtilization > 1.0) {
    failures.push(`Schub: η=${shearUtilization.toFixed(2)} > 1.0`)
  }

  return {
    bendingUtilization,
    shearUtilization,
    isOk: failures.length === 0,
    failureReason: failures.length > 0 ? failures.join('; ') : undefined,
  }
}
