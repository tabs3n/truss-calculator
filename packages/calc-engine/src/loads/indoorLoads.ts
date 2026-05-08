/**
 * Horizontale Ersatzlasten für Innenbetrieb nach DIN EN 17879.
 *
 * Drei Lastfälle, maßgebend ist das Maximum (verglichen über Kippmoment):
 *   1. Imperfektionslast: 2.5% der Gesamtvertikallast auf Stützenkopfhöhe
 *   2. Anprall: 1.0 kN bei h = 1.0 m am ungünstigsten Tower
 *   3. Ersatzflächenlast (nur wenn Tore offen):
 *        h ≤ 4.0 m → qh = 0.13 kN/m²
 *        h > 4.0 m → qh = 0.06 kN/m²
 */

export type IndoorGoverningCase = 'IMPERFECTION' | 'IMPACT' | 'SURFACE'

export interface IndoorLoadResult {
  forceKN: number
  applicationHeightM: number
  governingCase: IndoorGoverningCase
  /** Einzelergebnisse für Report */
  details: {
    imperfectionForceKN: number
    impactForceKN: number
    surfaceForceKN: number
    surfacePressureKNm2: number
  }
}

export const INDOOR_IMPACT_FORCE_KN = 1.0
export const INDOOR_IMPACT_HEIGHT_M = 1.0

/** Imperfektionslast: 2.5% der Bemessungs-Gesamtvertikallast [kN] */
export function getIndoorImperfectionForce(totalVerticalKN: number): number {
  return 0.025 * totalVerticalKN
}

/**
 * Ersatzflächendruck nach DIN EN 17879 in Abhängigkeit der Bauhöhe [kN/m²].
 * Nur ansetzen wenn Tore geöffnet werden können.
 */
export function getIndoorSurfacePressure(maxHeightM: number): number {
  return maxHeightM <= 4.0 ? 0.13 : 0.06
}

/**
 * Bestimmt die maßgebende Indoor-Horizontallast.
 *
 * @param totalVerticalKN   Gesamte Bemessungs-Vertikallast [kN]
 * @param maxSupportHeightM Maximale Stützenhöhe [m]
 * @param refAreaM2         Referenzfläche (projizierte Fläche) [m²]
 * @param doorsCanOpen      Ob Tore geöffnet werden können (Ersatzflächenlast)
 */
export function getGoverningIndoorLoad(
  totalVerticalKN: number,
  maxSupportHeightM: number,
  refAreaM2: number,
  doorsCanOpen: boolean,
): IndoorLoadResult {
  if (maxSupportHeightM <= 0) {
    throw new Error(`Ungültige Stützenhöhe: ${maxSupportHeightM} m`)
  }
  if (refAreaM2 < 0) {
    throw new Error(`Ungültige Referenzfläche: ${refAreaM2} m²`)
  }

  // 1. Imperfektion: wirkt auf Stützenkopfhöhe
  const impForce = getIndoorImperfectionForce(totalVerticalKN)
  const impHeight = maxSupportHeightM
  const impMoment = impForce * impHeight

  // 2. Anprall: 1.0 kN bei h = 1.0 m
  const impactForce = INDOOR_IMPACT_FORCE_KN
  const impactHeight = INDOOR_IMPACT_HEIGHT_M
  const impactMoment = impactForce * impactHeight

  // 3. Ersatzflächenlast: Resultierende wirkt auf Schwerpunkthöhe = h/2
  const surfPressure = doorsCanOpen ? getIndoorSurfacePressure(maxSupportHeightM) : 0
  const surfForce = surfPressure * refAreaM2
  const surfHeight = maxSupportHeightM / 2
  const surfMoment = surfForce * surfHeight

  const cases = [
    { force: impForce,    height: impHeight,    moment: impMoment,    type: 'IMPERFECTION' as IndoorGoverningCase },
    { force: impactForce, height: impactHeight, moment: impactMoment, type: 'IMPACT'       as IndoorGoverningCase },
    { force: surfForce,   height: surfHeight,   moment: surfMoment,   type: 'SURFACE'      as IndoorGoverningCase },
  ]

  const governing = cases.reduce((prev, curr) => curr.moment > prev.moment ? curr : prev)

  return {
    forceKN: governing.force,
    applicationHeightM: governing.height,
    governingCase: governing.type,
    details: {
      imperfectionForceKN: impForce,
      impactForceKN: impactForce,
      surfaceForceKN: surfForce,
      surfacePressureKNm2: surfPressure,
    },
  }
}
