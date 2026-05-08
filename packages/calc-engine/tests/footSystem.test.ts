import { describe, expect, it } from 'vitest'
import type { Support } from '../src/types.js'
import { getFootProperties, getFootWeightKg } from '../src/materials/database.js'
import { calculateTipping } from '../src/tipping/tippingCheck.js'

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function makeSupport(id: string, x: number, y: number, overrides: Partial<Support> = {}): Support {
  return {
    id,
    label: id,
    position: { x, y },
    trussType: 'PROLYTE_H40V',
    height: 4,
    footType: 'BASEPLATE',
    existingBallast: 0,
    ...overrides,
  }
}

// 4-Stützen-Rechteck: 6 m (X) × 4 m (Y)
const A = makeSupport('A', 0, 0)
const B = makeSupport('B', 0, 4)
const C = makeSupport('C', 6, 0)
const D = makeSupport('D', 6, 4)
const rect4 = [A, B, C, D]
const reactions1kn = new Map(rect4.map(s => [s.id, 1]))

// ─── FOOT_DATABASE / getFootProperties ──────────────────────────────────────

describe('getFootProperties – Datenbankwerte', () => {
  it('CONCRETE_BLOCK_1250: weightKg=1250, tippingArm=600mm, countsAsBallast=true, stackable=true', () => {
    const p = getFootProperties('CONCRETE_BLOCK_1250')
    expect(p.weightKg).toBe(1250)
    expect(p.tippingArmX).toBe(600)
    expect(p.tippingArmY).toBe(600)
    expect(p.countsAsBallast).toBe(true)
    expect(p.stackable).toBe(true)
    expect(p.additionalStackWeightKg).toBe(1250)
    expect(p.footprintX).toBe(1200)
    expect(p.footprintY).toBe(1200)
  })

  it('BASEPLATE: countsAsBallast=false, stackable=false, tippingArm=300mm', () => {
    const p = getFootProperties('BASEPLATE')
    expect(p.countsAsBallast).toBe(false)
    expect(p.stackable).toBe(false)
    expect(p.tippingArmX).toBe(300)
    expect(p.tippingArmY).toBe(300)
    expect(p.additionalStackWeightKg).toBe(0)
  })

  it('TRUSS_PLATE_30x30: tippingArm=150mm, countsAsBallast=false', () => {
    const p = getFootProperties('TRUSS_PLATE_30x30')
    expect(p.tippingArmX).toBe(150)
    expect(p.tippingArmY).toBe(150)
    expect(p.countsAsBallast).toBe(false)
  })
})

describe('getFootWeightKg – Stapelgewicht', () => {
  const base: Support = makeSupport('X', 0, 0, { footType: 'CONCRETE_BLOCK_1250' })

  it('1 Block (default) = 1250 kg', () => {
    expect(getFootWeightKg(base)).toBe(1250)
  })

  it('numberOfConcreteBlocks = 1 → 1250 kg', () => {
    expect(getFootWeightKg({ ...base, numberOfConcreteBlocks: 1 })).toBe(1250)
  })

  it('numberOfConcreteBlocks = 2 → 2500 kg', () => {
    expect(getFootWeightKg({ ...base, numberOfConcreteBlocks: 2 })).toBe(2500)
  })

  it('numberOfConcreteBlocks = 3 → 3750 kg', () => {
    expect(getFootWeightKg({ ...base, numberOfConcreteBlocks: 3 })).toBe(3750)
  })

  it('BASEPLATE ist nicht stapelbar → immer weightKg=15', () => {
    const bp = makeSupport('Y', 0, 0, { footType: 'BASEPLATE' })
    expect(getFootWeightKg(bp)).toBe(15)
    expect(getFootWeightKg({ ...bp, numberOfConcreteBlocks: 5 })).toBe(15)
  })
})

describe('calculateTipping – Kipparm aus Fußsystem', () => {
  describe('Betonblock (tippingArm = 0.6 m) vs Bodenplatte (tippingArm = 0.3 m)', () => {
    const supportsBlock = rect4.map(s => ({ ...s, footType: 'CONCRETE_BLOCK_1250' as const }))
    const supportsBase  = rect4   // BASEPLATE, tippingArm = 0.3 m

    it('Betonblock erfordert weniger Ballast als Bodenplatte (größerer Kipparm)', () => {
      // math angle 0° = Ostwind, Kippachse C/D
      const resultBlock = calculateTipping(supportsBlock, 10, 0, 4, reactions1kn)
      const resultBase  = calculateTipping(supportsBase,  10, 0, 4, reactions1kn)

      expect(resultBlock.requiredBallastTotalKg).toBeLessThan(resultBase.requiredBallastTotalKg)
    })

    it('Betonblock: alle Stützen stabilisieren – A/B mit 6.6 m, C/D (windseitig) mit 0.6 m', () => {
      // Stabilisierung: C(0.6) + D(0.6) + A(6.6) + B(6.6) = 14.4 kN·m
      // Windmoment: 10 × 4 = 40 kN·m, Defizit = 25.6 kN·m
      // Ballast auf A/B (maxLeverArm=6.6): 25600 / (9.81 × 6.6) ≈ 395 kg
      const result = calculateTipping(supportsBlock, 10, 0, 4, reactions1kn)
      expect(result.requiredBallastTotalKg).toBeCloseTo(25600 / (9.81 * 6.6), 0)
    })

    it('Bodenplatte: stabilisierende Stützen A und B haben Hebelarm = 6 + 0.3 = 6.3 m', () => {
      const result = calculateTipping(supportsBase, 10, 0, 4, reactions1kn)
      expect(result.requiredBallastTotalKg).toBeCloseTo(
        Math.max(0, 40 - (1 * 0.3 + 1 * 0.3 + 1 * 6.3 + 1 * 6.3)) * 1000 / (9.81 * 6.3),
        0,
      )
    })

    it('Windseitige Stützen (C, D) tragen mit Kipparm = 0.6 m zur Stabilisierung bei (Betonblock)', () => {
      const resultBlock = calculateTipping(supportsBlock, 10, 0, 4, reactions1kn)
      // stabilisierend: C(0.6) + D(0.6) + A(6.6) + B(6.6) = 14.4 kN·m (mit Betonblock)
      // stabilisierend ohne Betonblock (alt): A(6) + B(6) = 12 kN·m
      // Daher weniger Defizit mit Betonblock:
      const resultBase = calculateTipping(supportsBase, 10, 0, 4, reactions1kn)
      expect(resultBlock.requiredBallastTotalKg).toBeLessThan(resultBase.requiredBallastTotalKg)
    })
  })

  describe('BASEPLATE mit outriggerLength überschreibt Datenbankwert', () => {
    // outriggerLength = 1.0 m → tippingArm = 1.0 m (viel größer als Standard 0.3 m)
    const supportsOutrigger = rect4.map(s => ({
      ...s,
      footType: 'BASEPLATE' as const,
      outriggerLength: 1.0,
    }))
    const supportsNoOutrigger = rect4  // Standard BASEPLATE 0.3 m

    it('outriggerLength=1.0m erfordert deutlich weniger Ballast als Standard-Bodenplatte', () => {
      const resultOut = calculateTipping(supportsOutrigger, 10, 0, 4, reactions1kn)
      const resultStd = calculateTipping(supportsNoOutrigger, 10, 0, 4, reactions1kn)
      expect(resultOut.requiredBallastTotalKg).toBeLessThan(resultStd.requiredBallastTotalKg)
    })

    it('outriggerLength=1.0m: Hebelarm leeseitige Stützen = 6 + 1.0 = 7.0 m', () => {
      // Stabilisierung: C(1.0) + D(1.0) + A(7.0) + B(7.0) = 16 kN·m
      // Defizit = max(0, 40 - 16) = 24 kN·m
      // Ballast = 24000 / (9.81 × 7.0) ≈ 349 kg
      const result = calculateTipping(supportsOutrigger, 10, 0, 4, reactions1kn)
      expect(result.requiredBallastTotalKg).toBeCloseTo(24000 / (9.81 * 7.0), 0)
    })
  })

  describe('ballastSupportIds bei 4-Stützen-System', () => {
    it('Ballast wird auf leeseitigen Stützen A und B angesetzt (nicht auf C und D)', () => {
      const result = calculateTipping(rect4, 10, 0, 4, reactions1kn)
      // math angle 0° = Ostwind: C und D sind windseitig, A und B leeseitig
      expect(result.ballastSupportIds).toContain('A')
      expect(result.ballastSupportIds).toContain('B')
      expect(result.ballastSupportIds).not.toContain('C')
      expect(result.ballastSupportIds).not.toContain('D')
    })
  })
})
