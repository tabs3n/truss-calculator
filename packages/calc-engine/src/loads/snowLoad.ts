/**
 * Schneelast nach DIN EN 1991-1-3 (Eurocode 1 Teil 3) inkl. NA Deutschland.
 *
 * Anwendung: Outdoor-Bühnen im Winter. Schneelast wirkt auf horizontale
 * Flächen (Dächer, Plateaus). Bei reinen Traversen-Konstruktionen ohne
 * Dach ist die Schneelast meist 0; sie wird relevant sobald Membrandächer,
 * Bauplanen oder ähnliche horizontale Flächen aufgespannt sind.
 *
 * Formel (Dach):  s = μ_i · C_e · C_t · s_k                       (5.1)
 *
 *  s    Schneelast auf dem Dach [kN/m²]
 *  μ_i  Formbeiwert (1 = Flachdach < 30°, ansonsten reduzierbar)
 *  C_e  Umgebungskoeffizient (windig 0.8 / normal 1.0 / geschützt 1.2)
 *  C_t  Temperaturbeiwert (i.d.R. 1.0)
 *  s_k  charakteristische Schneelast am Boden [kN/m²]
 *
 * s_k nach DIN EN 1991-1-3/NA Tabelle NA.2 abhängig von Schneelastzone
 * und Geländehöhe A [m über NN]:
 *
 *  Zone 1:        s_k = max(0,19 + 0,91 · ((A + 140)/760)², 0,65)
 *  Zone 1a:       s_k = max(0,25 + 1,91 · ((A + 140)/760)², 0,80)
 *  Zone 2:        s_k = max(0,25 + 1,91 · ((A + 140)/760)², 0,85)
 *  Zone 2a:       s_k = max(0,31 + 2,91 · ((A + 140)/760)², 1,05)
 *  Zone 3:        s_k = max(0,31 + 2,91 · ((A + 140)/760)², 1,10)
 *
 * Diese Werte gelten bis Höhen von etwa 1500 m. Für Höhen darüber muss
 * der Standortkoeffizient gesondert ermittelt werden.
 */

export type SnowZone = '1' | '1a' | '2' | '2a' | '3'

/** Umgebungskoeffizient C_e nach DIN EN 1991-1-3 Tabelle 5.1 (NA) */
export type SnowExposure = 'WINDIG' | 'NORMAL' | 'GESCHUETZT'

const EXPOSURE_FACTOR: Record<SnowExposure, number> = {
  WINDIG: 0.8,
  NORMAL: 1.0,
  GESCHUETZT: 1.2,
}

/**
 * Charakteristische Schneelast am Boden s_k in kN/m².
 * @param zone Schneelastzone (1, 1a, 2, 2a, 3)
 * @param altitudeM Geländehöhe über NN in Metern (0–1500)
 */
export function getCharacteristicSnowLoad(zone: SnowZone, altitudeM: number): number {
  if (altitudeM < 0) throw new Error(`Ungültige Höhe: ${altitudeM} m`)
  if (altitudeM > 1500) throw new Error(`Höhe ${altitudeM} m über Gültigkeitsbereich (max. 1500 m)`)

  const aFactor = ((altitudeM + 140) / 760) ** 2

  switch (zone) {
    case '1':
      return Math.max(0.19 + 0.91 * aFactor, 0.65)
    case '1a':
      return Math.max(0.25 + 1.91 * aFactor, 0.80)
    case '2':
      return Math.max(0.25 + 1.91 * aFactor, 0.85)
    case '2a':
      return Math.max(0.31 + 2.91 * aFactor, 1.05)
    case '3':
      return Math.max(0.31 + 2.91 * aFactor, 1.10)
  }
}

/**
 * Formbeiwert μ_i für Flachdächer oder geneigte Dächer.
 *
 * DIN EN 1991-1-3 Tabelle 5.2 (vereinfacht):
 *   0° ≤ α ≤ 30°  → μ = 0.8
 *   30° < α < 60° → μ = 0.8 · (60 − α) / 30
 *   α ≥ 60°       → μ = 0 (Schnee rutscht ab)
 */
export function getShapeFactor(roofPitchDeg: number): number {
  if (roofPitchDeg < 0) throw new Error(`Ungültige Dachneigung: ${roofPitchDeg}°`)
  if (roofPitchDeg <= 30) return 0.8
  if (roofPitchDeg < 60) return 0.8 * (60 - roofPitchDeg) / 30
  return 0
}

export interface SnowLoadInput {
  zone: SnowZone
  altitudeM: number
  /** Dachneigung 0–90° (0 = flach) */
  roofPitchDeg?: number
  /** Umgebungskoeffizient C_e */
  exposure?: SnowExposure
  /** Temperaturkoeffizient C_t (default 1.0, reduziert bei warmen Dächern) */
  thermalFactor?: number
}

export interface SnowLoadResult {
  /** Charakteristische Bodenschneelast s_k [kN/m²] */
  characteristicGroundLoadKNm2: number
  /** Formbeiwert μ_i (dimensionslos) */
  shapeFactor: number
  /** Umgebungskoeffizient C_e */
  exposureFactor: number
  /** Temperaturkoeffizient C_t */
  thermalFactor: number
  /** Schneelast auf Dachfläche s [kN/m²] */
  roofLoadKNm2: number
}

/**
 * Berechnet die Schneelast s auf einer Dachfläche.
 * Liefert charakteristischen Wert (ohne γQ).
 */
export function calculateSnowLoad(input: SnowLoadInput): SnowLoadResult {
  const altitudeM = input.altitudeM
  const sk = getCharacteristicSnowLoad(input.zone, altitudeM)
  const mu = getShapeFactor(input.roofPitchDeg ?? 0)
  const ce = EXPOSURE_FACTOR[input.exposure ?? 'NORMAL']
  const ct = input.thermalFactor ?? 1.0

  return {
    characteristicGroundLoadKNm2: sk,
    shapeFactor: mu,
    exposureFactor: ce,
    thermalFactor: ct,
    roofLoadKNm2: mu * ce * ct * sk,
  }
}
