import { describe, expect, it } from 'vitest'

import { calculate } from '../src/index.js'
import {
  checkSoilPressure,
  getAllowableSoilPressureKNm2,
  getContactAreaM2,
  SOIL_BEARING_KNM2,
} from '../src/soil/soilPressureCheck.js'
import type { StructureInput, Support } from '../src/types.js'

function makeBaseInput(): StructureInput {
  return {
    projectName: 'Test', eventName: '-', location: 'Köln', date: '2026-05-29', preparedBy: 'tb',
    windZone: 1, terrainCategory: 'II', environment: 'OUTDOOR',
    frictionConfig: { mode: 'PRESET', preset: 'RUBBER_ON_CONCRETE' },
    supports: [], beams: [],
  }
}

function support(id: string, x: number, overrides: Partial<Support> = {}): Support {
  return {
    id, label: id, position: { x, y: 0 }, trussType: 'PROLYTE_H40V', height: 4,
    footType: 'BASEPLATE', baseplateSize: 0.6, existingBallast: 0, ...overrides,
  }
}

describe('getContactAreaM2', () => {
  it('BASEPLATE nutzt baseplateSize²', () => {
    expect(getContactAreaM2(support('A', 0, { baseplateSize: 0.8 }))).toBeCloseTo(0.64, 3)
  })
  it('CONCRETE_BLOCK nutzt 1,2 × 1,2 m Aufstandsfläche', () => {
    expect(getContactAreaM2(support('A', 0, { footType: 'CONCRETE_BLOCK_1250' }))).toBeCloseTo(1.44, 3)
  })
})

describe('getAllowableSoilPressureKNm2', () => {
  it('Default (undefined) = PAVED', () => {
    expect(getAllowableSoilPressureKNm2(undefined)).toBe(SOIL_BEARING_KNM2.PAVED)
  })
  it('CUSTOM nutzt customValue', () => {
    expect(getAllowableSoilPressureKNm2('CUSTOM', 120)).toBe(120)
  })
  it('CUSTOM ohne gültigen Wert wirft', () => {
    expect(() => getAllowableSoilPressureKNm2('CUSTOM', 0)).toThrow()
  })
})

describe('checkSoilPressure', () => {
  const supports = [support('A', 0, { baseplateSize: 0.5 }), support('B', 5, { baseplateSize: 0.5 })]
  // Aufstandsfläche 0,25 m². 50 kN / 0,25 = 200 kN/m².
  const reactions = new Map([['A', 50], ['B', 50]])

  it('σ = N/A korrekt', () => {
    const r = checkSoilPressure(supports, reactions, 'GRAVEL') // zul. 200
    expect(r.supports[0]!.pressureKNm2).toBeCloseTo(200, 0)
    expect(r.allowableKNm2).toBe(200)
    expect(r.supports[0]!.utilization).toBeCloseTo(1.0, 2)
    expect(r.isOk).toBe(true)
  })

  it('weicher Boden → Nachweis nicht erfüllt', () => {
    const r = checkSoilPressure(supports, reactions, 'SOFT_GROUND') // zul. 75
    expect(r.isOk).toBe(false)
    expect(r.governingUtilization).toBeGreaterThan(1)
  })
})

describe('Integration: Bodenpressung im Gesamtergebnis', () => {
  it('befestigter Untergrund (Default) ist unkritisch', () => {
    const input: StructureInput = {
      ...makeBaseInput(),
      supports: [support('A', 0, { existingBallast: 1000 }), support('B', 5, { existingBallast: 1000 })],
      beams: [],
    }
    const r = calculate(input)
    expect(r.soilPressure.isOk).toBe(true)
    expect(r.proofFailures.some(m => /Bodenpressung/.test(m))).toBe(false)
  })

  it('weicher Boden mit viel Ballast → Bodenpressung als proofFailure', () => {
    const input: StructureInput = {
      ...makeBaseInput(),
      soilClass: 'SOFT_GROUND',
      supports: [
        support('A', 0, { baseplateSize: 0.4, existingBallast: 3000 }),
        support('B', 5, { baseplateSize: 0.4, existingBallast: 3000 }),
      ],
      beams: [],
    }
    const r = calculate(input)
    expect(r.soilPressure.isOk).toBe(false)
    expect(r.proofFailures.some(m => /Bodenpressung/.test(m))).toBe(true)
    expect(r.overallOk).toBe(false)
    // Keine echten Berechnungsfehler:
    expect(r.errors).toHaveLength(0)
  })
})
