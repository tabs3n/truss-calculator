import { describe, expect, it } from 'vitest'
import type { Support } from '../src/types.js'
import { calculateTipping, calculateTippingAllDirections } from '../src/tipping/tippingCheck.js'

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
  it('calculateTipping: berechnet Zusatzballast aus dem Momentendefizit', () => {
    const reactions = new Map(supports.map(support => [support.id, 1]))
    const result = calculateTipping(supports, 10, 0, 4, reactions)

    expect(result.isOk).toBe(false)
    expect(result.requiredBallastTotalKg).toBeGreaterThan(0)
    expect(result.minVerticalReactionKN).toBeLessThan(0)
    expect(result.ballastSupportIds).toEqual(['A', 'B'])
  })

  it('calculateTipping: setzt Ballast auf der Kippachse nicht als stabilisierenden Hebelarm an', () => {
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

// Rechteck 6 m (X) × 4 m (Y): Nord-Süd-Tiefe = 4 m, Ost-West-Breite = 6 m
// → Nordwind (Kompass 0°) hat Hebelarm 4 m, Ostwind (90°) hat Hebelarm 6 m
// → Nordwind erfordert mehr Ballast (kleinerer Hebelarm bei gleichem Moment)
describe('calculateTippingAllDirections – Windrichtungsmodi', () => {
  const reactions = new Map(supports.map(s => [s.id, 1]))

  describe('AUTO-Modus', () => {
    it('berechnet genau 4 Richtungen', () => {
      const result = calculateTippingAllDirections(supports, () => 10, 4, reactions, 'AUTO')
      expect(result.directions).toHaveLength(4)
    })

    it('directions enthalten die Kompasswinkel 0 90 180 270', () => {
      const result = calculateTippingAllDirections(supports, () => 10, 4, reactions, 'AUTO')
      expect(result.directions.map(d => d.angleDeg)).toEqual([0, 90, 180, 270])
    })

    it('governing ist der Lastfall mit dem höchsten Ballastbedarf', () => {
      const result = calculateTippingAllDirections(supports, () => 10, 4, reactions, 'AUTO')
      const maxBallast = Math.max(...result.directions.map(d => d.result.requiredBallastTotalKg))
      expect(result.governing.requiredBallastTotalKg).toBeCloseTo(maxBallast, 6)
    })

    it('governingAngleDeg ist einer der berechneten Winkel', () => {
      const result = calculateTippingAllDirections(supports, () => 10, 4, reactions, 'AUTO')
      const angles = result.directions.map(d => d.angleDeg)
      expect(angles).toContain(result.governingAngleDeg)
    })

    it('ohne windMode-Argument verhält sich wie AUTO', () => {
      const auto = calculateTippingAllDirections(supports, () => 10, 4, reactions, 'AUTO')
      const implicit = calculateTippingAllDirections(supports, () => 10, 4, reactions)
      expect(implicit.directions).toHaveLength(auto.directions.length)
      expect(implicit.governingAngleDeg).toBe(auto.governingAngleDeg)
    })
  })

  describe('MANUAL-Modus', () => {
    it('berechnet nur die angegebenen Richtungen', () => {
      const result = calculateTippingAllDirections(supports, () => 10, 4, reactions, 'MANUAL', [0, 90])
      expect(result.directions).toHaveLength(2)
      expect(result.directions.map(d => d.angleDeg)).toEqual([0, 90])
    })

    it('Nordwind (0°) erfordert mehr Ballast als Ostwind (90°) beim asymmetrischen Grundriss', () => {
      // Rechteck 6×4: Tiefe Nord-Süd = 4 m → kleinerer Hebelarm → mehr Ballast
      const result = calculateTippingAllDirections(supports, () => 10, 4, reactions, 'MANUAL', [0, 90])
      const north = result.directions.find(d => d.angleDeg === 0)!
      const east  = result.directions.find(d => d.angleDeg === 90)!
      expect(north.result.requiredBallastTotalKg).toBeGreaterThan(east.result.requiredBallastTotalKg)
    })

    it('governing ist der ungünstigste der angegebenen Richtungen', () => {
      const result = calculateTippingAllDirections(supports, () => 10, 4, reactions, 'MANUAL', [0, 90])
      expect(result.governingAngleDeg).toBe(0)
      expect(result.governing.requiredBallastTotalKg).toBeCloseTo(
        result.directions.find(d => d.angleDeg === 0)!.result.requiredBallastTotalKg, 6,
      )
    })

    it('einzelne Richtung gibt genau ein Ergebnis zurück', () => {
      const result = calculateTippingAllDirections(supports, () => 10, 4, reactions, 'MANUAL', [180])
      expect(result.directions).toHaveLength(1)
      expect(result.governingAngleDeg).toBe(180)
    })

    it('leeres manualWindDirections fällt auf 4 Richtungen zurück', () => {
      const result = calculateTippingAllDirections(supports, () => 10, 4, reactions, 'MANUAL', [])
      expect(result.directions).toHaveLength(4)
    })
  })
})
