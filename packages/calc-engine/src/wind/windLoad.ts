import type { TerrainCategory, WindZone } from '../types'

// Luftdichte nach DIN EN 1991-1-4
const AIR_DENSITY = 1.25 // kg/m³

// Grundwindgeschwindigkeit vb nach Windzone, DIN EN 1991-1-4 NA Tab. NA.B.3
const BASIC_WIND_VELOCITY: Record<WindZone, number> = {
  1: 22.5,
  2: 25.0,
  3: 27.5,
  4: 30.0,
}

// Rauigkeitslänge z0 und Mindesthöhe zmin nach DIN EN 1991-1-4 Tab. 4.1
export function getRoughnessLength(category: TerrainCategory): { z0: number; zMin: number } {
  switch (category) {
    case 'I':   return { z0: 0.01, zMin: 1 }
    case 'II':  return { z0: 0.05, zMin: 2 }
    case 'III': return { z0: 0.30, zMin: 5 }
    case 'IV':  return { z0: 1.00, zMin: 10 }
  }
}

// Geländefaktor kr nach DIN EN 1991-1-4 Gl. 4.5
export function getTerrainFactor(z0: number): number {
  return 0.19 * Math.pow(z0 / 0.05, 0.07)
}

// Rauigkeitsbeiwert cr(z) nach DIN EN 1991-1-4 Gl. 4.4
export function getRoughnessFactor(z: number, z0: number, zMin: number): number {
  const zEff = Math.max(z, zMin)
  const kr = getTerrainFactor(z0)
  return kr * Math.log(zEff / z0)
}

// Turbulenzintensität Iv(z) nach DIN EN 1991-1-4 Gl. 4.7
export function getTurbulenceIntensity(z: number, z0: number, zMin: number): number {
  const zEff = Math.max(z, zMin)
  return 1 / Math.log(zEff / z0)
}

// Böengeschwindigkeitsdruck qp(z) in kN/m² nach DIN EN 1991-1-4 Gl. 4.8
export function getPeakVelocityPressure(
  windZone: WindZone,
  terrainCategory: TerrainCategory,
  heightAboveGround: number,
): number {
  if (heightAboveGround <= 0) {
    throw new Error(`Ungültige Höhe: ${heightAboveGround} m (muss > 0 sein)`)
  }
  if (heightAboveGround > 200) {
    throw new Error(`Höhe ${heightAboveGround} m überschreitet Gültigkeitsbereich (max. 200 m)`)
  }

  const vb = BASIC_WIND_VELOCITY[windZone]
  const { z0, zMin } = getRoughnessLength(terrainCategory)
  const zEff = Math.max(heightAboveGround, zMin)

  const cr = getRoughnessFactor(zEff, z0, zMin)
  const vm = cr * vb                            // mittlere Windgeschwindigkeit m/s
  const Iv = getTurbulenceIntensity(zEff, z0, zMin)

  // qp(z) = (1 + 7·Iv) · 0.5 · ρ · vm² — Ergebnis in N/m², dann ÷1000 → kN/m²
  const qp_Nm2 = (1 + 7 * Iv) * 0.5 * AIR_DENSITY * vm * vm
  return qp_Nm2 / 1000
}

// Windkraft Fw in kN nach DIN EN 1991-1-4 Gl. 5.3
export function calculateWindForce(
  qp: number,       // kN/m²
  width: number,    // m
  height: number,   // m
  cf = 1.3,         // Kraftbeiwert, konservativ für Traverse/Equipment
): number {
  return cf * qp * width * height
}
