import type { ConnectionResult, TrussType } from '../types'
import { getTrussProperties } from '../materials/database'
import { DYNAMIC_FACTOR, G } from '../loads/loadCombinations'

/**
 * Verbindungs- und Kupplungsnachweise.
 *
 * 1) Kupplung je Hängelast: Anschlussmittel (Halfcoupler/Schelle) hat eine
 *    Tragfähigkeit (WLL) in kg. Nachweis: Last × Dynamikzuschlag ≤ WLL.
 *    Standard-Halfcoupler liegen je nach Typ bei 340–750 kg.
 *
 * 2) Gurtrohr-/Knotennachweis der Stütze: Die vertikale Auflagerkraft verteilt
 *    sich auf die 4 Gurtrohre; je Gurtrohr N/4 ≤ Nch,Rd. Dies ist ein LOKALER
 *    Tragfähigkeitsnachweis der Verbindung/Knoten und unabhängig vom globalen
 *    Knicknachweis. Nch,Rd stammt aus der verifizierten Systemstatik.
 */

/** Standard-Tragfähigkeit eines Anschlussmittels (Halfcoupler), wenn nichts angegeben ist. */
export const DEFAULT_COUPLER_WLL_KG = 500

export function checkCoupler(
  loadKg: number,
  wllKg: number,
  dynamicFactor: number = DYNAMIC_FACTOR,
): { actingKg: number; capacityKg: number; utilization: number; isOk: boolean } {
  const actingKg = loadKg * dynamicFactor
  const utilization = wllKg > 0 ? actingKg / wllKg : Infinity
  return { actingKg, capacityKg: wllKg, utilization, isOk: utilization <= 1 }
}

/**
 * Gurtrohr-/Knotennachweis: vertikale Auflagerkraft auf 4 Gurtrohre verteilt.
 * @param verticalReactionKN  Auflagerkraft (Bemessungswert STR)
 */
export function checkChordNode(
  trussType: TrussType,
  verticalReactionKN: number,
): { chordForceKN: number; chordResistanceKN: number; utilization: number; isOk: boolean } {
  const props = getTrussProperties(trussType)
  const chordForceKN = Math.abs(verticalReactionKN) / 4
  const chordResistanceKN = props.normalForceResistance
  const utilization = chordResistanceKN > 0 ? chordForceKN / chordResistanceKN : Infinity
  return { chordForceKN, chordResistanceKN, utilization, isOk: utilization <= 1 }
}

/** Wandelt kg in kN (Gewichtskraft). */
export function kgToKN(kg: number): number {
  return (kg * G) / 1000
}

export interface CouplerCheckInput {
  id: string
  label: string
  weightKg: number
  wllKg: number
}

export interface ChordNodeCheckInput {
  id: string
  label: string
  trussType: TrussType
  verticalReactionKN: number
}

/** Führt alle Verbindungsnachweise aus und liefert eine flache Ergebnisliste. */
export function checkConnections(
  couplers: CouplerCheckInput[],
  chordNodes: ChordNodeCheckInput[],
  dynamicFactor: number = DYNAMIC_FACTOR,
): ConnectionResult[] {
  const results: ConnectionResult[] = []

  for (const c of couplers) {
    const r = checkCoupler(c.weightKg, c.wllKg, dynamicFactor)
    results.push({
      id: c.id,
      label: c.label,
      kind: 'COUPLER',
      actingValue: r.actingKg,
      capacityValue: r.capacityKg,
      unit: 'kg',
      utilization: r.utilization,
      isOk: r.isOk,
    })
  }

  for (const n of chordNodes) {
    const r = checkChordNode(n.trussType, n.verticalReactionKN)
    results.push({
      id: n.id,
      label: n.label,
      kind: 'NODE',
      actingValue: r.chordForceKN,
      capacityValue: r.chordResistanceKN,
      unit: 'kN',
      utilization: r.utilization,
      isOk: r.isOk,
    })
  }

  return results
}
