import type { TrussType } from '../types'

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
