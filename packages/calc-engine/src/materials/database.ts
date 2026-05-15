import type { FootType, Support, TrussType } from '../types'

// ─────────────────────────────────────────────
// FUßSYSTEM-DATENBANK
// ─────────────────────────────────────────────

export interface FootSystemProperties {
  id: FootType
  label: string
  weightKg: number              // Eigengewicht des Fußes
  footprintX: number            // mm – Abmessung in X
  footprintY: number            // mm – Abmessung in Y
  height: number                // mm
  /** Abstand Stützenmittelpunkt → Kippachse in X-Richtung (= halbe Fußbreite X) */
  tippingArmX: number           // mm
  /** Abstand Stützenmittelpunkt → Kippachse in Y-Richtung (= halbe Fußbreite Y) */
  tippingArmY: number           // mm
  countsAsBallast: boolean      // Eigengewicht zählt als stabilisierender Ballast
  stackable: boolean            // können mehrere gestapelt werden
  additionalStackWeightKg: number  // Gewicht je zusätzlichem Block
}

export const FOOT_DATABASE: Record<FootType, FootSystemProperties> = {
  CONCRETE_BLOCK_1250: {
    id: 'CONCRETE_BLOCK_1250',
    label: 'Betonblock 1250 kg',
    weightKg: 1250,
    footprintX: 1200,
    footprintY: 1200,
    height: 400,
    tippingArmX: 600,           // 1200 / 2
    tippingArmY: 600,
    countsAsBallast: true,
    stackable: true,
    additionalStackWeightKg: 1250,
  },
  BASEPLATE: {
    id: 'BASEPLATE',
    label: 'Bodenplatte',
    weightKg: 15,
    footprintX: 600,            // Standardmaß; wird durch Support.baseplateSize überschrieben
    footprintY: 600,
    height: 0,
    tippingArmX: 300,           // Standardwert; wird durch Support.outriggerLength überschrieben
    tippingArmY: 300,
    countsAsBallast: false,
    stackable: false,
    additionalStackWeightKg: 0,
  },
  TRUSS_PLATE_30x30: {
    id: 'TRUSS_PLATE_30x30',
    label: 'Traversenplatte 30×30 cm',
    weightKg: 5,
    footprintX: 300,
    footprintY: 300,
    height: 0,
    tippingArmX: 150,
    tippingArmY: 150,
    countsAsBallast: false,
    stackable: false,
    additionalStackWeightKg: 0,
  },
}

export function getFootProperties(footType: FootType): FootSystemProperties {
  return FOOT_DATABASE[footType]
}

/**
 * Gesamtgewicht des Fußsystems in kg.
 * Für CONCRETE_BLOCK_1250 gilt: weightKg + (numberOfConcreteBlocks − 1) × additionalStackWeightKg.
 */
export function getFootWeightKg(support: Support): number {
  const props = FOOT_DATABASE[support.footType]
  if (!props.stackable) return props.weightKg
  const n = Math.max(1, support.numberOfConcreteBlocks ?? 1)
  return props.weightKg + (n - 1) * props.additionalStackWeightKg
}

export interface TrussProperties {
  label: string
  weightPerMeter: number        // kg/m
  crossSectionArea: number      // cm²
  momentOfInertiaY: number      // cm⁴
  momentOfInertiaZ: number      // cm⁴
  eModulus: number              // kN/cm²
  bendingResistanceY: number    // My,Rd in kN·m
  bendingResistanceZ: number    // Mz,Rd in kN·m
  shearResistanceY: number      // Vy,Rd in kN
  shearResistanceZ: number      // Vz,Rd in kN
  normalForceResistance: number // Nch,Rd in kN (Gurtrohr)
  material: 'ALUMINIUM_6082_T6' | 'STEEL_S235' | 'STEEL_S355'
}

// Quelle: CLAUDE.md / Systemstatik Prolyte, Eurotruss Herstellerdatenblätter
export const TRUSS_DATABASE: Record<TrussType, TrussProperties> = {
  PROLYTE_H40V: {
    // Quelle: Projektvorgabe AGENTS.md, verifizierte Systemstatik-Werte Prolyte H40V.
    label: 'Prolyte H40V',
    weightPerMeter: 6.9,
    crossSectionArea: 16.96,
    momentOfInertiaY: 4917.1,
    momentOfInertiaZ: 4917.1,
    eModulus: 7000.0,
    bendingResistanceY: 34.05,
    bendingResistanceZ: 34.05,
    shearResistanceY: 18.94,
    shearResistanceZ: 18.94,
    normalForceResistance: 50.22,
    material: 'ALUMINIUM_6082_T6',
  },

  PROLYTE_H30D: {
    // Quelle: Projektvorgabe AGENTS.md, Referenzwerte Prolyte H30D; Nch aus Prolyte Technical Matters H30-Serie.
    label: 'Prolyte H30D',
    weightPerMeter: 5.0,
    crossSectionArea: 12.72,
    momentOfInertiaY: 1395.32,
    momentOfInertiaZ: 1849.29,
    eModulus: 7000.0,
    bendingResistanceY: 10.39,
    bendingResistanceZ: 12.0,
    shearResistanceY: 7.36,
    shearResistanceZ: 12.76,
    normalForceResistance: 30.54,
    material: 'ALUMINIUM_6082_T6',
  },

  PROLYTE_H30V: {
    // Quelle: Prolyte Product Data Sheet H30V / Technical Specs H30-Serie.
    label: 'Prolyte H30V',
    weightPerMeter: 6.3,
    crossSectionArea: 16.96,
    momentOfInertiaY: 2095.9,
    momentOfInertiaZ: 2095.9,
    eModulus: 7000.0,
    bendingResistanceY: 14.60,
    bendingResistanceZ: 14.60,
    shearResistanceY: 9.95,
    shearResistanceZ: 9.95,
    normalForceResistance: 30.54,
    material: 'ALUMINIUM_6082_T6',
  },

  PROLYTE_S40T: {
    // Quelle: Prolyte Technical Matters / Blackbook-Strukturdaten S40T.
    label: 'Prolyte S40T',
    weightPerMeter: 12.0,
    crossSectionArea: 23.12,
    momentOfInertiaY: 5699.0,
    momentOfInertiaZ: 2800.0,
    eModulus: 7000.0,
    bendingResistanceY: 21.60,
    // SCHÄTZUNG: schwache Achse konservativ aus Iy/Iz-Verhältnis zu My skaliert.
    bendingResistanceZ: 10.61,
    // SCHÄTZUNG: Prolyte veröffentlicht für S40T nur die maßgebende Vertikal-Schertragfähigkeit im Blackbook-Auszug.
    shearResistanceY: 12.00,
    shearResistanceZ: 23.46,
    normalForceResistance: 31.86,
    material: 'ALUMINIUM_6082_T6',
  },

  PROLYTE_S52F: {
    // Quelle: Prolyte Product Data Sheet S52F und Prolyte Technical Matters S52-Serie.
    label: 'Prolyte S52F',
    weightPerMeter: 12.0,
    crossSectionArea: 23.12,
    momentOfInertiaY: 10906.2,
    // SCHÄTZUNG: Falttraverse, schwache Achse konservativ mit S52V-Z-Achse aus Technical Matters angesetzt.
    momentOfInertiaZ: 3650.0,
    eModulus: 7000.0,
    bendingResistanceY: 39.12,
    // SCHÄTZUNG: schwache Achse konservativ aus Iz/Iy-Verhältnis zu My skaliert.
    bendingResistanceZ: 13.09,
    shearResistanceY: 18.00,
    shearResistanceZ: 18.00,
    normalForceResistance: 41.62,
    material: 'ALUMINIUM_6082_T6',
  },

  EUROTRUSS_TD44: {
    // Quelle: Eurotruss HD44/TD44 Datenblatt; Widerstände aus HD44-Lasttabelle konservativ rückgerechnet.
    label: 'Eurotruss TD44',
    weightPerMeter: 9.5,
    // SCHÄTZUNG: 4 Hauptrohre 50 x 3 mm, Diagonalen nicht als Längsfläche angesetzt.
    crossSectionArea: 17.72,
    // SCHÄTZUNG: 4 Hauptrohre 50 x 3 mm auf ca. 350 mm Rohrmittenabstand.
    momentOfInertiaY: 5470.0,
    momentOfInertiaZ: 5470.0,
    eModulus: 7000.0,
    // SCHÄTZUNG: aus Eurotruss HD44 CPL 837 kg bei 10 m: M = P * L / 4 ≈ 20,5 kNm, auf 20,0 kNm abgerundet.
    bendingResistanceY: 20.0,
    bendingResistanceZ: 20.0,
    // SCHÄTZUNG: aus Eurotruss HD44 UDL 599 kg/m bei 5 m: V = q * L / 2 ≈ 14,7 kN, abgerundet.
    shearResistanceY: 14.0,
    shearResistanceZ: 14.0,
    normalForceResistance: 30.54,
    material: 'ALUMINIUM_6082_T6',
  },

  EUROTRUSS_ST50: {
    // Quelle: Eurotruss ST Square Truss Datenblatt; Widerstände aus ST-Lasttabelle konservativ rückgerechnet.
    label: 'Eurotruss ST50',
    weightPerMeter: 13.5,
    crossSectionArea: 23.12,
    // SCHÄTZUNG: 4 Hauptrohre 50 x 4 mm auf ca. 450 mm Rohrmittenabstand.
    momentOfInertiaY: 12250.0,
    momentOfInertiaZ: 12250.0,
    eModulus: 7000.0,
    // SCHÄTZUNG: aus Eurotruss ST UDL 326 kg/m bei 10 m: M = q * L² / 8 ≈ 40,0 kNm.
    bendingResistanceY: 40.0,
    bendingResistanceZ: 40.0,
    // SCHÄTZUNG: aus Eurotruss ST UDL 326 kg/m bei 10 m: V = q * L / 2 ≈ 16,0 kN.
    shearResistanceY: 16.0,
    shearResistanceZ: 16.0,
    normalForceResistance: 41.62,
    material: 'ALUMINIUM_6082_T6',
  },

  PIPE_48_3_STEEL: {
    // Quelle: Projektvorgabe AGENTS.md für Gewicht/A/I/E; Widerstände analytisch aus Rohr Ø48,3 x 3,2 S235.
    label: 'Rohr Ø48.3×3.2 Stahl S235',
    weightPerMeter: 3.56,
    crossSectionArea: 4.53,
    momentOfInertiaY: 10.78,
    momentOfInertiaZ: 10.78,
    eModulus: 21000.0,
    bendingResistanceY: 0.95,
    bendingResistanceZ: 0.95,
    // SCHÄTZUNG: konservativer Querschnittswert unterhalb des reinen Schubfließwerts.
    shearResistanceY: 20.0,
    shearResistanceZ: 20.0,
    normalForceResistance: 90.0,
    material: 'STEEL_S235',
  },

  PIPE_50_3_ALU: {
    // Quelle: analytische Rohrquerschnittswerte Ø50 x 3 mm, EN AW 6082-T6.
    label: 'Rohr Ø50×3 ALU EN AW 6082-T6',
    weightPerMeter: 1.20,
    crossSectionArea: 4.43,
    momentOfInertiaY: 12.28,
    momentOfInertiaZ: 12.28,
    eModulus: 7000.0,
    bendingResistanceY: 1.16,
    bendingResistanceZ: 1.16,
    // SCHÄTZUNG: konservativer Querschnittswert unterhalb des reinen Schubfließwerts.
    shearResistanceY: 40.0,
    shearResistanceZ: 40.0,
    normalForceResistance: 100.0,
    material: 'ALUMINIUM_6082_T6',
  },
}

export function getTrussProperties(trussType: TrussType): TrussProperties {
  const props = TRUSS_DATABASE[trussType]
  if (!props) {
    throw new Error(`Unbekannter Traversentyp: ${trussType}`)
  }
  return props
}

// ─────────────────────────────────────────────
// MATERIAL-KENNWERTE FÜR STABILITÄT (Knicken)
// ─────────────────────────────────────────────

export type MaterialId = TrussProperties['material']

export interface MaterialProperties {
  /** Streckgrenze fy in kN/cm² */
  yieldStrength: number
  /**
   * Knickkurvenparameter nach EC9 Tab. 6.6 (Aluminium) bzw. EC3 Tab. 6.1 (Stahl).
   * α = Imperfektionsbeiwert, lambda0 = Plateaugrenze.
   */
  imperfectionFactor: number
  limitSlenderness: number
}

const MATERIAL_PROPERTIES: Record<MaterialId, MaterialProperties> = {
  // EN AW-6082 T6: fy ≈ 26 kN/cm² (260 N/mm²); Klasse A → α=0.20, λ̄0=0.10
  ALUMINIUM_6082_T6: { yieldStrength: 26.0, imperfectionFactor: 0.20, limitSlenderness: 0.10 },
  // S235: fy = 23.5 kN/cm² (235 N/mm²); nahtloses Rohr → Kurve a (α=0.21, λ̄0=0.20)
  STEEL_S235:        { yieldStrength: 23.5, imperfectionFactor: 0.21, limitSlenderness: 0.20 },
  // S355: fy = 35.5 kN/cm²; nahtloses Rohr → Kurve a
  STEEL_S355:        { yieldStrength: 35.5, imperfectionFactor: 0.21, limitSlenderness: 0.20 },
}

export function getMaterialProperties(material: MaterialId): MaterialProperties {
  return MATERIAL_PROPERTIES[material]
}
