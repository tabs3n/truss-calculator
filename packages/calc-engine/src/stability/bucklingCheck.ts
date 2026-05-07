import type { TrussType } from '../types.js'
import { getTrussProperties } from '../materials/database.js'

// Teilsicherheitsbeiwert Aluminium Stabilitätsnachweis nach DIN EN 1999-1-1
const GAMMA_M2 = 1.25

/**
 * Euler-Knicknachweis für Druckstab nach DIN EN 1999-1-1 Kap. 6.3
 * Ncr = π² · E · I / (β · L)²
 */
export function checkBuckling(
  trussType: TrussType,
  heightM: number,
  bucklingFactor: number = 2.0, // β=2.0 für Kragstütze (eingespannt-frei)
  normalForceKN: number,
): { utilization: number; isOk: boolean; criticalLoadKN: number } {
  if (heightM <= 0) throw new Error(`Ungültige Stützenhöhe: ${heightM} m`)
  if (normalForceKN < 0) throw new Error(`Druckkraft muss positiv sein: ${normalForceKN} kN`)

  const props = getTrussProperties(trussType)

  // EI in kN·cm², Knicklänge sk in cm
  const EI = props.eModulus * props.momentOfInertiaY
  const sk_cm = bucklingFactor * heightM * 100

  // Kritische Knicklast Ncr in kN, DIN EN 1999-1-1 Gl. 6.49
  const Ncr = (Math.PI ** 2 * EI) / (sk_cm ** 2)

  // Bemessungswert der Knicklast (vereinfachend: Nch,Rd / γM2)
  // Ausnutzung: NEd / Ncr × γM2
  const utilization = (normalForceKN * GAMMA_M2) / Ncr

  return {
    utilization,
    isOk: utilization <= 1.0,
    criticalLoadKN: Ncr,
  }
}
