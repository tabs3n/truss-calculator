import type { TrussType } from '../types'
import { getMaterialProperties, getTrussProperties } from '../materials/database'
import { GAMMA_M1 } from '../loads/loadCombinations'

/**
 * Vollständiger Knicknachweis nach DIN EN 1999-1-1 Kap. 6.3.1 (Aluminium)
 * bzw. DIN EN 1993-1-1 Kap. 6.3.1 (Stahl).
 *
 *   Ncr = π² · E · I / (β · L)²                   (Euler)
 *   Npl = A · fy                                  (Querschnittstragfähigkeit)
 *   λ̄  = √(Npl / Ncr)                            (bezogene Schlankheit)
 *   Φ   = 0.5 · [1 + α · (λ̄ - λ̄₀) + λ̄²]
 *   χ   = 1 / (Φ + √(Φ² - λ̄²))     ≤ 1.0
 *   Nb,Rd = χ · Npl / γM1
 *
 * Vorteil gegenüber reiner Euler-Betrachtung: für gedrungene Stützen wird die
 * Querschnittstragfähigkeit Npl maßgebend (χ → 1, aber durch γM1 begrenzt),
 * für sehr schlanke Stützen geht das Ergebnis in Ncr / γM1 über.
 */
export function checkBuckling(
  trussType: TrussType,
  heightM: number,
  bucklingFactor: number = 2.0, // β=2.0 für Kragstütze (eingespannt-frei)
  normalForceKN: number,
): {
  utilization: number
  isOk: boolean
  criticalLoadKN: number          // Ncr (Euler)
  plasticLoadKN: number           // Npl = A · fy
  reducedSlenderness: number      // λ̄
  reductionFactor: number         // χ
  bucklingResistanceKN: number    // Nb,Rd = χ · Npl / γM1
} {
  if (heightM <= 0) throw new Error(`Ungültige Stützenhöhe: ${heightM} m`)
  if (normalForceKN < 0) throw new Error(`Druckkraft muss positiv sein: ${normalForceKN} kN`)

  const props = getTrussProperties(trussType)
  const mat = getMaterialProperties(props.material)

  // 1. Euler-Knicklast Ncr in kN. EI in kN·cm², sk in cm.
  const EI = props.eModulus * props.momentOfInertiaY
  const sk_cm = bucklingFactor * heightM * 100
  const Ncr = (Math.PI ** 2 * EI) / (sk_cm ** 2)

  // 2. Plastische Querschnittstragfähigkeit Npl = A · fy
  const Npl = props.crossSectionArea * mat.yieldStrength

  // 3. Bezogene Schlankheit
  const lambdaBar = Math.sqrt(Npl / Ncr)

  // 4. Reduktionsbeiwert χ
  const phi = 0.5 * (1 + mat.imperfectionFactor * (lambdaBar - mat.limitSlenderness) + lambdaBar * lambdaBar)
  const radicand = phi * phi - lambdaBar * lambdaBar
  const chi = radicand > 0
    ? Math.min(1.0, 1 / (phi + Math.sqrt(radicand)))
    : 1.0

  // 5. Bemessungswert der Knicklast und Ausnutzung
  const Nb_Rd = (chi * Npl) / GAMMA_M1
  const utilization = Nb_Rd > 0 ? normalForceKN / Nb_Rd : Infinity

  return {
    utilization,
    isOk: utilization <= 1.0,
    criticalLoadKN: Ncr,
    plasticLoadKN: Npl,
    reducedSlenderness: lambdaBar,
    reductionFactor: chi,
    bucklingResistanceKN: Nb_Rd,
  }
}
