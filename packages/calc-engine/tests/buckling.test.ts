import { describe, it, expect } from 'vitest'
import { checkBuckling } from '../src/stability/bucklingCheck.js'

describe('Knicknachweis Stütze', () => {
  it('H40V, h=4m, β=2.0, N=10kN → Ncr >> N, isOk=true', () => {
    const result = checkBuckling('PROLYTE_H40V', 4, 2.0, 10)
    expect(result.isOk).toBe(true)
    expect(result.criticalLoadKN).toBeGreaterThan(100)
    expect(result.utilization).toBeLessThan(1.0)
  })

  it('Ncr korrekt berechnet (Handrechnung)', () => {
    // PROLYTE_H40V: E=7000 kN/cm², I=4917.1 cm⁴, sk=β×L=2×400cm=800cm
    // Ncr = π²×7000×4917.1 / 800² = 9.8696×34419700 / 640000 ≈ 530.8 kN
    const result = checkBuckling('PROLYTE_H40V', 4, 2.0, 0)
    expect(result.criticalLoadKN).toBeCloseTo(530.8, 0)
  })

  it('Stütze knickt bei sehr großer Druckkraft', () => {
    const result = checkBuckling('PIPE_48_3_STEEL', 6, 2.0, 200)
    expect(result.isOk).toBe(false)
  })

  it('wirft Fehler bei negativer Druckkraft', () => {
    expect(() => checkBuckling('PROLYTE_H40V', 4, 2.0, -1)).toThrow()
  })

  describe('χ-Verfahren nach EC9 6.3.1', () => {
    it('mittlere Schlankheit (H40V, h=4m): λ̄ ≈ 0.91, χ ≈ 0.72, Nb,Rd ≈ 287 kN', () => {
      // Npl = 16.96 cm² × 26 kN/cm² = 441.0 kN
      // Ncr = 530.8 kN → λ̄ = √(441/530.8) = 0.911
      // α=0.20, λ̄0=0.10:
      // Φ = 0.5 × (1 + 0.20 × 0.811 + 0.830) = 0.996
      // χ = 1 / (0.996 + √(0.992 - 0.830)) = 1 / 1.398 = 0.715
      // Nb,Rd = 0.715 × 441 / 1.10 = 286.7 kN
      const result = checkBuckling('PROLYTE_H40V', 4, 2.0, 100)
      expect(result.plasticLoadKN).toBeCloseTo(441.0, 0)
      expect(result.reducedSlenderness).toBeCloseTo(0.911, 2)
      expect(result.reductionFactor).toBeCloseTo(0.715, 2)
      expect(result.bucklingResistanceKN).toBeCloseTo(286.7, 0)
    })

    it('gedrungene Stütze (H40V, h=0.5m, β=1.0): χ = 1 (Plateau), Nb,Rd = Npl/γM1', () => {
      // sk = 50 cm → Ncr = π²×7000×4917.1 / 2500 = 135885 kN (sehr groß)
      // λ̄ = √(441/135885) = 0.057 < λ̄0=0.10 → χ = 1
      // Nb,Rd = 1.0 × 441 / 1.10 = 401 kN
      const result = checkBuckling('PROLYTE_H40V', 0.5, 1.0, 0)
      expect(result.reducedSlenderness).toBeLessThan(0.10)
      expect(result.reductionFactor).toBeCloseTo(1.0, 2)
      expect(result.bucklingResistanceKN).toBeCloseTo(401, 0)
    })

    it('gedrungene Stütze ist DURCH Querschnittstragfähigkeit begrenzt (Fix vs. reines Euler)', () => {
      // Ohne χ-Verfahren würde Ncr/γM2 = 135885/1.25 = 108708 kN erlaubt sein.
      // Mit χ-Verfahren: nur 401 kN (Querschnitt).
      // Test: 500 kN Druckkraft → muss NICHT OK sein.
      const result = checkBuckling('PROLYTE_H40V', 0.5, 1.0, 500)
      expect(result.isOk).toBe(false)
    })

    it('sehr schlanke Stütze: χ → 1/λ̄², Nb,Rd → Ncr/γM1', () => {
      // Steel S235 Pipe, 6m, β=2 → sk=12m, Ncr ≈ 1.55 kN, Npl ≈ 106.5 kN
      // λ̄ ≈ 8.3 → χ → 1/68.7 ≈ 0.0146
      // Nb,Rd ≈ Ncr/γM1 = 1.55/1.10 = 1.41 kN
      const result = checkBuckling('PIPE_48_3_STEEL', 6, 2.0, 0)
      expect(result.reducedSlenderness).toBeGreaterThan(5)
      expect(result.bucklingResistanceKN).toBeCloseTo(result.criticalLoadKN / 1.10, 1)
    })

    it('Auslastung ist Verhältnis NEd / Nb,Rd', () => {
      const result = checkBuckling('PROLYTE_H40V', 4, 2.0, 100)
      expect(result.utilization).toBeCloseTo(100 / result.bucklingResistanceKN, 5)
    })
  })
})
