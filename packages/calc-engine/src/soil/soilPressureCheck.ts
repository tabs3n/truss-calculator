import type { SoilClass, SoilPressureResult, SoilPressureSupportResult, Support } from '../types'
import { getFootProperties } from '../materials/database'

/**
 * Bodenpressungsnachweis (Sohldruck) – vereinfacht nach DIN EN 1997-1 / DIN 1054.
 *
 * σ = N / A  mit  N = vertikale Auflagerkraft (Bemessungswert, STR),
 *                 A = Aufstandsfläche des Fußsystems.
 *
 * Verglichen wird gegen einen zulässigen Sohldruck (Orientierungswert je
 * Untergrundklasse). Da hier konservativ die STR-Bemessungslast (γG=1.35)
 * gegen einen aufnehmbaren Sohldruck gestellt wird, liegt der Nachweis auf
 * der sicheren Seite. Für kritische Fälle bleibt ein Bodengutachten maßgebend.
 */

/** Zulässiger Sohldruck je Untergrundklasse [kN/m²] – Orientierungswerte. */
export const SOIL_BEARING_KNM2: Record<Exclude<SoilClass, 'CUSTOM'>, number> = {
  PAVED: 500,        // Beton / Asphalt, tragfähig befestigt
  PAVERS: 250,       // Verbund-/Betonsteinpflaster auf Tragschicht
  GRAVEL: 200,       // verdichteter Schotter / Kies
  FIRM_GROUND: 150,  // gewachsener Boden, fest (bindig steif / nichtbindig mitteldicht)
  SOFT_GROUND: 75,   // weicher Boden / Mutterboden / locker gelagerter Sand
}

export const DEFAULT_SOIL_CLASS: SoilClass = 'PAVED'

/** Liefert den zulässigen Sohldruck [kN/m²] aus Klasse bzw. Custom-Wert. */
export function getAllowableSoilPressureKNm2(
  soilClass: SoilClass | undefined,
  customValue?: number,
): number {
  if (soilClass === 'CUSTOM') {
    if (!Number.isFinite(customValue) || (customValue ?? 0) <= 0) {
      throw new Error(`Ungültiger Sohldruck: ${customValue} (muss > 0 kN/m²)`)
    }
    return customValue as number
  }
  return SOIL_BEARING_KNM2[(soilClass ?? DEFAULT_SOIL_CLASS) as Exclude<SoilClass, 'CUSTOM'>]
}

/**
 * Aufstandsfläche des Fußsystems [m²].
 * - BASEPLATE: baseplateSize² (Default 0,6 m)
 * - sonst: footprintX × footprintY aus der Datenbank (mm → m)
 *
 * Hinweis: Outrigger-getragener Ballast (z.B. IBC) verteilt sich real über
 * zusätzliche Fläche; das wird hier konservativ ignoriert (Pressung eher zu hoch).
 */
export function getContactAreaM2(support: Support): number {
  if (support.footType === 'BASEPLATE') {
    const size = support.baseplateSize ?? 0.6
    return size * size
  }
  const props = getFootProperties(support.footType)
  return (props.footprintX / 1000) * (props.footprintY / 1000)
}

/**
 * Bodenpressungsnachweis für alle Stützen.
 * @param verticalReactionsKN  Vertikale Auflagerkräfte (Bemessungswert STR) je Stütze
 */
export function checkSoilPressure(
  supports: Support[],
  verticalReactionsKN: Map<string, number>,
  soilClass: SoilClass | undefined,
  customValue?: number,
): SoilPressureResult {
  const allowableKNm2 = getAllowableSoilPressureKNm2(soilClass, customValue)

  const supportResults: SoilPressureSupportResult[] = supports.map(support => {
    const contactAreaM2 = Math.max(1e-6, getContactAreaM2(support))
    const reactionKN = Math.max(0, verticalReactionsKN.get(support.id) ?? 0)
    const pressureKNm2 = reactionKN / contactAreaM2
    const utilization = allowableKNm2 > 0 ? pressureKNm2 / allowableKNm2 : Infinity
    return {
      supportId: support.id,
      contactAreaM2,
      pressureKNm2,
      utilization,
      isOk: utilization <= 1,
    }
  })

  const governingUtilization = supportResults.reduce(
    (max, r) => Math.max(max, r.utilization),
    0,
  )

  return {
    allowableKNm2,
    supports: supportResults,
    governingUtilization,
    isOk: supportResults.every(r => r.isOk),
  }
}
