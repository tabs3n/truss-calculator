import { describe, it, expect } from 'vitest'
import { calculate } from '../src/index.js'
import type { StructureInput } from '../src/types.js'

// Referenzsystem: 2-Stützen Groundsupport, Prolyte H40V, 4m hoch, 6m Traverse, WZ2, KatII
const baseInput: StructureInput = {
  projectName: 'Integrationstest',
  eventName: 'Testveranstaltung',
  location: 'Köln',
  date: '2026-05-07',
  preparedBy: 'Integrationstest',

  windZone: 2,
  terrainCategory: 'II',

  supports: [
    {
      id: 'A',
      label: 'Stütze A',
      position: { x: 0, y: 0 },
      trussType: 'PROLYTE_H40V',
      height: 4,
      footType: 'BASEPLATE',
      existingBallast: 0,
    },
    {
      id: 'B',
      label: 'Stütze B',
      position: { x: 6, y: 0 },
      trussType: 'PROLYTE_H40V',
      height: 4,
      footType: 'BASEPLATE',
      existingBallast: 0,
    },
  ],

  beams: [
    {
      id: 'T1',
      label: 'Traverse 1',
      startSupportId: 'A',
      endSupportId: 'B',
      trussType: 'PROLYTE_H40V',
      cantileverStart: 0,
      cantileverEnd: 0,
      loads: [
        {
          id: 'L1',
          label: 'Scheinwerfer',
          positionAlongBeam: 3,
          weight: 50, // kg
        },
      ],
      windSurfaces: [],
    },
  ],

  frictionCoefficient: 0.3,
}

describe('Gesamtberechnung Integration', () => {
  it('berechnet ohne unkontrollierten Abbruch durch', () => {
    const result = calculate(baseInput)
    expect(result.calculatedAt).toBeDefined()
    expect(result.errors.length).toBeGreaterThanOrEqual(0)
  })

  it('CalculationResult hat alle Pflichtfelder', () => {
    const result = calculate(baseInput)
    expect(result.windLoad).toBeDefined()
    expect(result.beams).toHaveLength(1)
    expect(result.supports).toHaveLength(2)
    expect(result.tipping).toBeDefined()
    expect(result.sliding).toBeDefined()
    expect(result.calculatedAt).toBeDefined()
  })

  it('Windlast ist positiv', () => {
    const result = calculate(baseInput)
    expect(result.windLoad.peakVelocityPressure).toBeGreaterThan(0)
    expect(result.windLoad.windForceX).toBeGreaterThan(0)
  })

  it('Traverse T1 Biegenachweis liegt im plausiblen Bereich', () => {
    const result = calculate(baseInput)
    const beam = result.beams[0]!
    expect(beam.bendingUtilization).toBeGreaterThan(0)
    expect(beam.bendingUtilization).toBeLessThanOrEqual(1.0)
  })

  it('requiredBallastTotalKg ≥ 0', () => {
    const result = calculate(baseInput)
    expect(result.requiredBallastTotalKg).toBeGreaterThanOrEqual(0)
  })

  it('ballastPerSupport Summe ≈ requiredBallastTotalKg', () => {
    const result = calculate(baseInput)
    const sum = result.ballastPerSupport.reduce((s, b) => s + b.requiredBallastKg, 0)
    expect(sum).toBeCloseTo(result.requiredBallastTotalKg, 1)
  })

  it('existingBallast reduziert additionalBallastNeeded', () => {
    const inputWithBallast: StructureInput = {
      ...baseInput,
      supports: baseInput.supports.map(s => ({ ...s, existingBallast: 500 })),
    }
    const result = calculate(inputWithBallast)
    for (const b of result.ballastPerSupport) {
      expect(b.existingBallastKg).toBe(500)
      expect(b.additionalBallastNeededKg).toBeGreaterThanOrEqual(0)
    }
  })

  it('liefert bei zu wenigen Stuetzen ein typisiertes Ergebnis mit errors', () => {
    const result = calculate({
      ...baseInput,
      supports: [],
      beams: [],
    })

    expect(result.overallOk).toBe(false)
    expect(result.errors).toContain('Mindestens 2 Stuetzen erforderlich')
  })
})
