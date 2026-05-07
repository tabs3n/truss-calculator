import { describe, expect, it } from 'vitest'
import type { Support } from '../src/types.js'
import { calculateTipping } from '../src/tipping/tippingCheck.js'

const supports: Support[] = [
  {
    id: 'A',
    label: 'A',
    position: { x: 0, y: 0 },
    trussType: 'PROLYTE_H40V',
    height: 4,
    footType: 'BASEPLATE',
    existingBallast: 0,
  },
  {
    id: 'B',
    label: 'B',
    position: { x: 0, y: 4 },
    trussType: 'PROLYTE_H40V',
    height: 4,
    footType: 'BASEPLATE',
    existingBallast: 0,
  },
  {
    id: 'C',
    label: 'C',
    position: { x: 6, y: 0 },
    trussType: 'PROLYTE_H40V',
    height: 4,
    footType: 'BASEPLATE',
    existingBallast: 0,
  },
  {
    id: 'D',
    label: 'D',
    position: { x: 6, y: 4 },
    trussType: 'PROLYTE_H40V',
    height: 4,
    footType: 'BASEPLATE',
    existingBallast: 0,
  },
]

describe('Kippsicherheitsnachweis', () => {
  it('berechnet Zusatzballast aus dem Momentendefizit', () => {
    const reactions = new Map(supports.map(support => [support.id, 1]))
    const result = calculateTipping(supports, 10, 0, 4, reactions)

    expect(result.isOk).toBe(false)
    expect(result.requiredBallastTotalKg).toBeGreaterThan(0)
    expect(result.minVerticalReactionKN).toBeLessThan(0)
    expect(result.ballastSupportIds).toEqual(['A', 'B'])
  })

  it('setzt Ballast auf der Kippachse nicht als stabilisierenden Hebelarm an', () => {
    const reactions = new Map(supports.map(support => [support.id, 1]))
    const withoutAxisBallast = calculateTipping(supports, 10, 0, 4, reactions)
    const withAxisBallast = calculateTipping(
      supports.map(support => (
        support.id === 'C' || support.id === 'D'
          ? { ...support, existingBallast: 10_000 }
          : support
      )),
      10,
      0,
      4,
      reactions,
    )

    expect(withAxisBallast.requiredBallastTotalKg).toBeCloseTo(withoutAxisBallast.requiredBallastTotalKg, 6)
    expect(withAxisBallast.utilization).toBeCloseTo(withoutAxisBallast.utilization, 6)
  })
})
