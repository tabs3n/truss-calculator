import { describe, it, expect } from 'vitest'
import { calculate } from '../src/index.js'
import { calculateVariants, STANDARD_VARIANTS } from '../src/variants.js'
import type { StructureInput } from '../src/types.js'

const variantInput: StructureInput = {
  projectName: 'Varianten-Test',
  eventName: 'Test',
  location: 'Köln',
  date: '2026-05-15',
  preparedBy: 'Codex',
  windZone: 3,
  terrainCategory: 'II',
  environment: 'OUTDOOR',
  supports: [
    {
      id: 'A',
      label: 'Stütze A',
      position: { x: 0, y: 0 },
      trussType: 'PROLYTE_H40V',
      height: 5,
      footType: 'BASEPLATE',
      existingBallast: 0,
    },
    {
      id: 'B',
      label: 'Stütze B',
      position: { x: 8, y: 0 },
      trussType: 'PROLYTE_H40V',
      height: 5,
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
      loads: [],
      distributedLoads: [],
      windSurfaces: [
        {
          id: 'W1',
          label: 'Banner',
          width: 8,
          height: 4,
          centerHeightAboveGround: 4,
          surfaceType: 'BANNER_SOLID',
          surfaceOrientationDeg: 0,
          dragCoefficient: 1.3,
        },
      ],
    },
  ],
  frictionConfig: { mode: 'CUSTOM', customValue: 0.3 },
}

describe('calculateVariants', () => {
  it('berechnet alle Standardvarianten ohne die Basiseingabe zu mutieren', () => {
    const baseline = calculate(variantInput)
    const variants = calculateVariants(variantInput, STANDARD_VARIANTS)

    expect(variants).toHaveLength(STANDARD_VARIANTS.length)
    expect(variantInput.supports.every(support => support.footType === 'BASEPLATE')).toBe(true)
    expect(variantInput.supports.every(support => support.outriggerLength === undefined)).toBe(true)
    expect(variants.every(entry => entry.result.calculatedAt)).toBe(true)
    expect(variants.some(entry => entry.result.requiredBallastTotalKg < baseline.requiredBallastTotalKg)).toBe(true)
  })

  it('Outrigger-Variante reduziert den Zusatzballast gegenüber der Baseline', () => {
    const baseline = calculate(variantInput)
    const variants = calculateVariants(variantInput)
    const outriggerVariant = variants.find(entry => entry.variant.label === 'Mit Outrigger 1,5 m')

    expect(outriggerVariant).toBeDefined()
    expect(outriggerVariant!.result.requiredBallastTotalKg).toBeLessThan(baseline.requiredBallastTotalKg)
  })
})
