import { describe, it, expect } from 'vitest'
import { checkSliding } from '../src/sliding/slidingCheck.js'

describe('Gleitnachweis DIN EN 13814', () => {
  it('Fh=5kN, Fv=30kN, μ=0.3 → kein Ballast erforderlich', () => {
    // Fh/μ = 5/0.3 = 16.67 kN < 30 kN → kein Ballast
    const result = checkSliding(5, 30, 0.3)
    expect(result.isOk).toBe(true)
    expect(result.requiredBallastKg).toBeLessThan(0)
  })

  it('Fh=20kN, Fv=10kN, μ=0.3 → Ballast erforderlich', () => {
    // Fh/μ = 20/0.3 = 66.67 kN, Defizit = 66.67 - 10 = 56.67 kN
    // Ballast = 56670 N / 9.81 ≈ 5777 kg
    const result = checkSliding(20, 10, 0.3)
    expect(result.isOk).toBe(false)
    expect(result.requiredBallastKg).toBeGreaterThan(0)
    expect(result.requiredBallastKg).toBeCloseTo(5777, -2)
  })

  it('μ=0 wirft Fehler', () => {
    expect(() => checkSliding(10, 20, 0)).toThrow()
  })

  it('frictionCoefficientUsed wird korrekt zurückgegeben', () => {
    const result = checkSliding(10, 20, 0.3)
    expect(result.frictionCoefficientUsed).toBe(0.3)
  })
})
