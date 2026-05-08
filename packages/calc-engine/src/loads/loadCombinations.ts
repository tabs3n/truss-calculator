import type { TrussType } from '../types'
import { getTrussProperties } from '../materials/database'

// Teilsicherheitsbeiwerte nach DIN EN 1990
// STR (Tragwerksnachweis – Beam, Knicken)
export const GAMMA_G = 1.35   // ständige Lasten, ungünstig
export const GAMMA_Q = 1.50   // veränderliche Lasten, ungünstig

// EQU (Lagesicherheit – Kippen, Gleiten) Tab. A.1.2(A)
export const GAMMA_G_INF = 0.90  // ständige Lasten, günstig (stabilisierend)
export const GAMMA_G_SUP_EQU = 1.10  // ständige Lasten, ungünstig (destabilisierend)
// Hinweis: Veränderliche Lasten, die GÜNSTIG wirken (z.B. stabilisierende Hängelasten),
// dürfen im EQU nicht angesetzt werden (γQ,fav = 0).

// Materialsicherheit Aluminium (EC9)
export const GAMMA_M1 = 1.10   // Bauteilversagen (Stabilität)
export const GAMMA_M2 = 1.25   // Querschnittsversagen / Verbindungen

// Dynamikzuschlag nach DGUV Information 215-313
export const DYNAMIC_FACTOR = 1.20

// Erdbeschleunigung
export const G = 9.81 // m/s²

/** Bemessungslast: ständig → ×γG, veränderlich → ×γQ×1.20 */
export function getDesignLoad(
  characteristicLoad: number,
  loadType: 'permanent' | 'variable',
): number {
  if (loadType === 'permanent') {
    return characteristicLoad * GAMMA_G
  }
  return characteristicLoad * GAMMA_Q * DYNAMIC_FACTOR
}

/** Eigengewicht einer Traverse in kN (inkl. +5% Verbindungselemente) */
export function getBeamSelfWeight(trussType: TrussType, lengthM: number): number {
  const props = getTrussProperties(trussType)
  const massKg = props.weightPerMeter * lengthM * 1.05 // +5% Verbindungselemente
  return (massKg * G) / 1000 // kN
}

/**
 * 2,5%-Ersatzlast als horizontale Imperfektion nach DIN EN 1993-1-1 Kap. 5.3
 * Gibt Horizontallast pro Stütze zurück [kN]
 */
export function getImperfectionLoad(
  totalVerticalLoadKN: number,
  numberOfSupports: number,
): number {
  if (numberOfSupports <= 0) {
    throw new Error('Anzahl Stützen muss > 0 sein')
  }
  return (0.025 * totalVerticalLoadKN) / numberOfSupports
}
