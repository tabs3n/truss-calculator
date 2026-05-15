/**
 * Visuelle Querschnitts-Geometrie für die 3D-Darstellung.
 *
 * Diese Werte werden AUSSCHLIESSLICH für das Rendering verwendet,
 * nicht für statische Berechnungen. Quellen: Prolyte / Eurotruss Systemstatiken.
 *
 * Alle Maße in Metern.
 */

/** Querschnittsbreite (quadratisch) je Traversentyp in Metern. */
const TRUSS_WIDTH_M: Record<string, number> = {
  PROLYTE_H40V:    0.29,   // Prolyte H40V: 290 × 290 mm
  PROLYTE_H30D:    0.29,   // Prolyte H30D: 290 × 290 mm
  PROLYTE_H30V:    0.29,   // Prolyte H30V: 290 × 290 mm (geschätzt)
  PROLYTE_S40T:    0.40,   // Prolyte S40T: 400 × 400 mm
  PROLYTE_S52F:    0.52,   // Prolyte S52F: 520 × 520 mm (geschätzt)
  EUROTRUSS_TD44:  0.44,   // Eurotruss TD44: 440 × 440 mm
  EUROTRUSS_ST50:  0.50,   // Eurotruss ST50: 500 × 500 mm (geschätzt)
}

/**
 * Gibt die Querschnittsbreite einer Traverse in Metern zurück.
 * Fallback: 0.29 m (kleinste Standard-Traverse).
 */
export function getTrussWidthM(trussType: string | undefined): number {
  if (!trussType) return 0.29
  return TRUSS_WIDTH_M[trussType] ?? 0.29
}

/**
 * Lacing-Abstand in Abhängigkeit der Traversenbreite.
 * Entspricht grob dem Riegelabstand realer Fachwerkträger.
 */
export function getLacingSpacingM(trussWidthM: number): number {
  // Typische V-Lacing: Abstand ≈ 1,5 × Breite, min 0.6 m, max 1.5 m
  return Math.max(0.6, Math.min(1.5, trussWidthM * 1.5))
}
