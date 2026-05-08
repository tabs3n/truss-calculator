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
    normalForceResistance: 0, // TODO: Herstellerdaten eintragen
    material: 'ALUMINIUM_6082_T6',
  },

  PROLYTE_H30V: {
    label: 'Prolyte H30V',
    weightPerMeter: 4.5,       // TODO: Herstellerdaten eintragen
    crossSectionArea: 11.0,    // TODO: Herstellerdaten eintragen
    momentOfInertiaY: 1200.0,  // TODO: Herstellerdaten eintragen
    momentOfInertiaZ: 1200.0,  // TODO: Herstellerdaten eintragen
    eModulus: 7000.0,
    bendingResistanceY: 9.0,   // TODO: Herstellerdaten eintragen
    bendingResistanceZ: 9.0,   // TODO: Herstellerdaten eintragen
    shearResistanceY: 7.0,     // TODO: Herstellerdaten eintragen
    shearResistanceZ: 7.0,     // TODO: Herstellerdaten eintragen
    normalForceResistance: 0,  // TODO: Herstellerdaten eintragen
    material: 'ALUMINIUM_6082_T6',
  },

  PROLYTE_S40T: {
    label: 'Prolyte S40T',
    weightPerMeter: 7.2,       // TODO: Herstellerdaten eintragen
    crossSectionArea: 17.5,    // TODO: Herstellerdaten eintragen
    momentOfInertiaY: 5200.0,  // TODO: Herstellerdaten eintragen
    momentOfInertiaZ: 5200.0,  // TODO: Herstellerdaten eintragen
    eModulus: 7000.0,
    bendingResistanceY: 36.0,  // TODO: Herstellerdaten eintragen
    bendingResistanceZ: 36.0,  // TODO: Herstellerdaten eintragen
    shearResistanceY: 20.0,    // TODO: Herstellerdaten eintragen
    shearResistanceZ: 20.0,    // TODO: Herstellerdaten eintragen
    normalForceResistance: 0,  // TODO: Herstellerdaten eintragen
    material: 'ALUMINIUM_6082_T6',
  },

  PROLYTE_S52F: {
    label: 'Prolyte S52F',
    weightPerMeter: 12.0,      // TODO: Herstellerdaten eintragen
    crossSectionArea: 28.0,    // TODO: Herstellerdaten eintragen
    momentOfInertiaY: 15000.0, // TODO: Herstellerdaten eintragen
    momentOfInertiaZ: 15000.0, // TODO: Herstellerdaten eintragen
    eModulus: 7000.0,
    bendingResistanceY: 80.0,  // TODO: Herstellerdaten eintragen
    bendingResistanceZ: 80.0,  // TODO: Herstellerdaten eintragen
    shearResistanceY: 40.0,    // TODO: Herstellerdaten eintragen
    shearResistanceZ: 40.0,    // TODO: Herstellerdaten eintragen
    normalForceResistance: 0,  // TODO: Herstellerdaten eintragen
    material: 'ALUMINIUM_6082_T6',
  },

  EUROTRUSS_TD44: {
    label: 'Eurotruss TD44',
    weightPerMeter: 8.5,       // TODO: Herstellerdaten eintragen
    crossSectionArea: 20.0,    // TODO: Herstellerdaten eintragen
    momentOfInertiaY: 7500.0,  // TODO: Herstellerdaten eintragen
    momentOfInertiaZ: 7500.0,  // TODO: Herstellerdaten eintragen
    eModulus: 7000.0,
    bendingResistanceY: 45.0,  // TODO: Herstellerdaten eintragen
    bendingResistanceZ: 45.0,  // TODO: Herstellerdaten eintragen
    shearResistanceY: 25.0,    // TODO: Herstellerdaten eintragen
    shearResistanceZ: 25.0,    // TODO: Herstellerdaten eintragen
    normalForceResistance: 0,  // TODO: Herstellerdaten eintragen
    material: 'ALUMINIUM_6082_T6',
  },

  EUROTRUSS_ST50: {
    label: 'Eurotruss ST50',
    weightPerMeter: 10.0,      // TODO: Herstellerdaten eintragen
    crossSectionArea: 24.0,    // TODO: Herstellerdaten eintragen
    momentOfInertiaY: 11000.0, // TODO: Herstellerdaten eintragen
    momentOfInertiaZ: 11000.0, // TODO: Herstellerdaten eintragen
    eModulus: 7000.0,
    bendingResistanceY: 60.0,  // TODO: Herstellerdaten eintragen
    bendingResistanceZ: 60.0,  // TODO: Herstellerdaten eintragen
    shearResistanceY: 32.0,    // TODO: Herstellerdaten eintragen
    shearResistanceZ: 32.0,    // TODO: Herstellerdaten eintragen
    normalForceResistance: 0,  // TODO: Herstellerdaten eintragen
    material: 'ALUMINIUM_6082_T6',
  },

  PIPE_48_3_STEEL: {
    label: 'Rohr Ø48.3×3.2 Stahl S235',
    weightPerMeter: 3.56,
    crossSectionArea: 4.53,
    momentOfInertiaY: 10.78,
    momentOfInertiaZ: 10.78,
    eModulus: 21000.0,
    bendingResistanceY: 2.5,   // TODO: Herstellerdaten eintragen
    bendingResistanceZ: 2.5,   // TODO: Herstellerdaten eintragen
    shearResistanceY: 3.0,     // TODO: Herstellerdaten eintragen
    shearResistanceZ: 3.0,     // TODO: Herstellerdaten eintragen
    normalForceResistance: 0,  // TODO: Herstellerdaten eintragen
    material: 'STEEL_S235',
  },

  PIPE_50_3_ALU: {
    label: 'Rohr Ø50×3 ALU EN AW 6082-T6',
    weightPerMeter: 1.2,       // TODO: Herstellerdaten eintragen
    crossSectionArea: 4.43,    // TODO: Herstellerdaten eintragen
    momentOfInertiaY: 13.2,    // TODO: Herstellerdaten eintragen
    momentOfInertiaZ: 13.2,    // TODO: Herstellerdaten eintragen
    eModulus: 7000.0,
    bendingResistanceY: 1.0,   // TODO: Herstellerdaten eintragen
    bendingResistanceZ: 1.0,   // TODO: Herstellerdaten eintragen
    shearResistanceY: 1.5,     // TODO: Herstellerdaten eintragen
    shearResistanceZ: 1.5,     // TODO: Herstellerdaten eintragen
    normalForceResistance: 0,  // TODO: Herstellerdaten eintragen
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
