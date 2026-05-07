import type { SlidingResult } from '../types'

const G = 9.81 // m/s²

/**
 * Gleitnachweis nach DIN EN 13814
 * Ballast_gleiten = (Fh / μ) - Fv  [kN]
 * Negatives Ergebnis → kein Zusatzballast erforderlich
 */
export function checkSliding(
  totalHorizontalForceKN: number,
  totalVerticalForceKN: number,
  frictionCoefficient: number,
): SlidingResult {
  if (frictionCoefficient <= 0 || frictionCoefficient > 1) {
    throw new Error(`Ungültiger Reibbeiwert: ${frictionCoefficient} (muss 0 < μ ≤ 1)`)
  }

  // Erforderliche Vertikallast zum Verhindern von Gleiten [kN]
  const requiredVerticalKN = totalHorizontalForceKN / frictionCoefficient

  // Fehlender Anteil = Ballast in kN, dann → kg
  const deficitKN = requiredVerticalKN - totalVerticalForceKN
  const requiredBallastKg = (deficitKN * 1000) / G

  return {
    resultingHorizontalForceKN: totalHorizontalForceKN,
    requiredBallastKg,              // negativ = kein Ballast erforderlich
    isOk: deficitKN <= 0,
    frictionCoefficientUsed: frictionCoefficient,
  }
}
