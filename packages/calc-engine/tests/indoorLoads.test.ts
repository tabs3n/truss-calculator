import { describe, it, expect } from 'vitest'
import {
  getIndoorImperfectionForce,
  getIndoorSurfacePressure,
  getGoverningIndoorLoad,
  INDOOR_IMPACT_FORCE_KN,
  INDOOR_IMPACT_HEIGHT_M,
} from '../src/loads/indoorLoads.js'

describe('Indoor-Imperfektionslast', () => {
  it('2.5% von 100 kN → 2.5 kN', () => {
    expect(getIndoorImperfectionForce(100)).toBeCloseTo(2.5)
  })

  it('2.5% von 0 kN → 0 kN', () => {
    expect(getIndoorImperfectionForce(0)).toBe(0)
  })

  it('skaliert linear', () => {
    expect(getIndoorImperfectionForce(200)).toBeCloseTo(5.0)
  })
})

describe('Indoor-Ersatzflächendruck DIN EN 17879', () => {
  it('h=3.0m (≤4.0m) → qh=0.13 kN/m²', () => {
    expect(getIndoorSurfacePressure(3.0)).toBe(0.13)
  })

  it('h=4.0m (Grenzwert, ≤4.0m) → qh=0.13 kN/m²', () => {
    expect(getIndoorSurfacePressure(4.0)).toBe(0.13)
  })

  it('h=4.01m (>4.0m) → qh=0.06 kN/m²', () => {
    expect(getIndoorSurfacePressure(4.01)).toBe(0.06)
  })

  it('h=6.0m (>4.0m) → qh=0.06 kN/m²', () => {
    expect(getIndoorSurfacePressure(6.0)).toBe(0.06)
  })
})

describe('Indoor-Anprall Konstanten', () => {
  it('Anprallkraft = 1.0 kN', () => {
    expect(INDOOR_IMPACT_FORCE_KN).toBe(1.0)
  })

  it('Angriffshöhe = 1.0 m', () => {
    expect(INDOOR_IMPACT_HEIGHT_M).toBe(1.0)
  })
})

describe('getGoverningIndoorLoad – maßgebender Lastfall', () => {
  it('Imperfektion regiert bei großer Vertikallast, kleiner Fläche, geschlossenen Toren', () => {
    // Fv=200kN → Imperfektion = 5kN × h=3m = 15 kN·m
    // Anprall = 1kN × 1m = 1 kN·m
    // Fläche = 0 (Tore geschlossen)
    const result = getGoverningIndoorLoad(200, 3, 2, false)
    expect(result.governingCase).toBe('IMPERFECTION')
    expect(result.forceKN).toBeCloseTo(5.0)
    expect(result.applicationHeightM).toBe(3)
  })

  it('Anprall regiert bei kleiner Vertikallast und kleiner Höhe', () => {
    // Fv=1kN → Imperfektion = 0.025kN × 0.5m = 0.0125 kN·m
    // Anprall = 1kN × 1m = 1 kN·m  ← größer
    const result = getGoverningIndoorLoad(1, 0.5, 0, false)
    expect(result.governingCase).toBe('IMPACT')
    expect(result.forceKN).toBe(1.0)
    expect(result.applicationHeightM).toBe(1.0)
  })

  it('Ersatzfläche regiert bei großer Fläche und offenen Toren', () => {
    // Fv=5kN → Imperfektion = 0.125kN × 6m = 0.75 kN·m
    // Anprall = 1kN × 1m = 1 kN·m
    // Fläche: qh=0.06 (h>4m), A=100m² → F=6kN, h=3m → M=18 kN·m  ← größer
    const result = getGoverningIndoorLoad(5, 6, 100, true)
    expect(result.governingCase).toBe('SURFACE')
    expect(result.forceKN).toBeCloseTo(0.06 * 100)
    expect(result.applicationHeightM).toBeCloseTo(3.0)
  })

  it('doorsCanOpen=false → keine Ersatzflächenlast', () => {
    const open   = getGoverningIndoorLoad(5, 6, 100, true)
    const closed = getGoverningIndoorLoad(5, 6, 100, false)
    expect(open.details.surfaceForceKN).toBeGreaterThan(0)
    expect(closed.details.surfaceForceKN).toBe(0)
  })

  it('Detailwerte werden korrekt befüllt', () => {
    const result = getGoverningIndoorLoad(80, 4, 10, true)
    // Imperfektion: 0.025×80 = 2 kN
    expect(result.details.imperfectionForceKN).toBeCloseTo(2.0)
    // Anprall: 1.0 kN
    expect(result.details.impactForceKN).toBe(1.0)
    // Fläche: h=4m → qh=0.13, F=0.13×10=1.3 kN
    expect(result.details.surfacePressureKNm2).toBe(0.13)
    expect(result.details.surfaceForceKN).toBeCloseTo(1.3)
  })

  it('wirft bei ungültiger Höhe', () => {
    expect(() => getGoverningIndoorLoad(100, 0, 10, false)).toThrow()
  })

  it('wirft bei negativer Fläche', () => {
    expect(() => getGoverningIndoorLoad(100, 3, -1, false)).toThrow()
  })

  it('Handrechnung – h=5m, Fv=40kN, A=8m², Tore offen', () => {
    // Imperfektion: 0.025×40=1kN, h=5m → M=5 kN·m
    // Anprall: 1kN × 1m = 1 kN·m
    // Fläche: qh=0.06 (h>4m), F=0.06×8=0.48kN, h=2.5m → M=1.2 kN·m
    // Maßgebend: Imperfektion
    const result = getGoverningIndoorLoad(40, 5, 8, true)
    expect(result.governingCase).toBe('IMPERFECTION')
    expect(result.forceKN).toBeCloseTo(1.0)
    expect(result.applicationHeightM).toBe(5)
  })
})
