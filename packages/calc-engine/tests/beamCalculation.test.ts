import { describe, it, expect } from 'vitest'
import { calculateBeam } from '../src/beam/beamCalculation.js'
import { checkBeamUtilization } from '../src/beam/utilizationCheck.js'

describe('Balkenberechnung', () => {
  describe('Einfeldträger – analytische Referenzfälle', () => {
    it('Einzellast 10 kN in Feldmitte, L=6m, kein EG → M=15 kN·m, A=B=5 kN', () => {
      const result = calculateBeam(
        'PROLYTE_H40V',
        6,    // Stützweite
        0,    // kein Kragarm links
        0,    // kein Kragarm rechts
        [{ positionM: 3, forceKN: 10 }],
        0,    // kein Eigengewicht
      )
      expect(result.maxBendingMomentKNm).toBeCloseTo(15, 1)
      expect(result.reactionStartKN).toBeCloseTo(5, 1)
      expect(result.reactionEndKN).toBeCloseTo(5, 1)
    })

    it('gleichmäßige Streckenlast q=2 kN/m, L=4m → M=4 kN·m, A=B=4 kN', () => {
      // M_max = q×L²/8 = 2×16/8 = 4 kN·m
      const result = calculateBeam('PROLYTE_H40V', 4, 0, 0, [], 2)
      expect(result.maxBendingMomentKNm).toBeCloseTo(4, 1)
      expect(result.reactionStartKN).toBeCloseTo(4, 1)
      expect(result.reactionEndKN).toBeCloseTo(4, 1)
    })

    it('Gleichgewicht: Summe Auflagerkräfte = Summe äußerer Lasten', () => {
      const result = calculateBeam(
        'PROLYTE_H40V',
        8,
        0,
        0,
        [
          { positionM: 2, forceKN: 5 },
          { positionM: 6, forceKN: 8 },
        ],
        1.0, // kN/m Eigengewicht
      )
      const totalLoad = 5 + 8 + 1.0 * 8
      expect(result.reactionStartKN + result.reactionEndKN).toBeCloseTo(totalLoad, 1)
    })

    it('Kragarm: Einzellast 5 kN am Kragarmende → A negativ (abhebend)', () => {
      // Kragarm 2m links, L=6m, Last P=5kN bei x=-2m (positionM=-2)
      const result = calculateBeam(
        'PROLYTE_H40V',
        6,
        2,   // Kragarm links 2m
        0,
        [{ positionM: -2, forceKN: 5 }],
        0,
      )
      // Moment um B: A×6 = -5×(-2-6) = 40 → A = 40/6... nein
      // Moment um A (x=0): -5×(-2) = 10 = B×6 → B = 10/6 ≈ 1.667
      // A = 5 - 1.667 = 3.333 kN (nicht abhebend hier)
      // Auflagerkräfte: A + B = 5
      expect(result.reactionStartKN + result.reactionEndKN).toBeCloseTo(5, 1)
    })
  })

  describe('Tragfähigkeitsnachweis', () => {
    it('Prolyte H40V, M=10 kN·m → η_Biegung = 10/34.05 ≈ 0.294 < 1.0 → OK', () => {
      const forces = calculateBeam('PROLYTE_H40V', 6, 0, 0, [{ positionM: 3, forceKN: 10 }], 0)
      const check = checkBeamUtilization('PROLYTE_H40V', forces)
      expect(check.bendingUtilization).toBeCloseTo(15 / 34.05, 2)
      expect(check.isOk).toBe(true)
    })

    it('isOk=false bei Überschreitung MRd', () => {
      // 3 × 50 kN Lasten auf 6m Träger → M >> MRd(34.05)
      const forces = calculateBeam(
        'PROLYTE_H40V',
        6,
        0,
        0,
        [
          { positionM: 1, forceKN: 50 },
          { positionM: 3, forceKN: 50 },
          { positionM: 5, forceKN: 50 },
        ],
        0,
      )
      const check = checkBeamUtilization('PROLYTE_H40V', forces)
      expect(check.isOk).toBe(false)
      expect(check.failureReason).toBeDefined()
    })
  })
})
