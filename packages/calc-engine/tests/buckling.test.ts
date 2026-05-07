import { describe, it, expect } from 'vitest'
import { checkBuckling } from '../src/stability/bucklingCheck.js'

describe('Knicknachweis Stütze', () => {
  it('H40V, h=4m, β=2.0, N=10kN → Ncr >> N, isOk=true', () => {
    // Ncr = π² × 7000 × 4917.1 / (2×400)² = 96821838 / 640000 ≈ 151.3 kN
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
})
