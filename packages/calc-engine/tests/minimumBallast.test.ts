import { describe, expect, it } from 'vitest'

import { calculate } from '../src/index.js'
import type { StructureInput } from '../src/types.js'

function makeBaseInput(): StructureInput {
  return {
    projectName: 'Test',
    eventName: '-',
    location: 'Köln',
    date: '2026-05-29',
    preparedBy: 'tb',
    windZone: 2,
    terrainCategory: 'III',
    environment: 'OUTDOOR',
    frictionConfig: { mode: 'PRESET', preset: 'RUBBER_ON_CONCRETE' },
    supports: [],
    beams: [],
  }
}

/** Zwei-Stützen-Outdoor-Setup mit Banner, das ohne Ballast nicht standsicher ist. */
function makeWindyTwoSupport(existingBallast: number): StructureInput {
  return {
    ...makeBaseInput(),
    supports: [
      { id: 'A', label: 'A', position: { x: 0, y: 0 }, trussType: 'PROLYTE_H40V', height: 6, footType: 'BASEPLATE', baseplateSize: 0.6, outriggerLength: 2, existingBallast },
      { id: 'B', label: 'B', position: { x: 5, y: 0 }, trussType: 'PROLYTE_H40V', height: 6, footType: 'BASEPLATE', baseplateSize: 0.6, outriggerLength: 2, existingBallast },
    ],
    beams: [{
      id: 'T', label: 'Top',
      startSupportId: 'A', endSupportId: 'B',
      trussType: 'PROLYTE_H40V',
      cantileverStart: 0, cantileverEnd: 0,
      loads: [],
      windSurfaces: [{
        id: 'W', label: 'Banner', width: 5, height: 1, centerHeightAboveGround: 5.5,
        surfaceType: 'BANNER_SOLID', surfaceOrientationDeg: 0, dragCoefficient: 1.3,
      }],
    }],
  }
}

describe('minimumRequiredBallastTotalKg', () => {
  it('ist unabhängig vom eingetragenen losen Ballast (Schwelle bleibt konstant)', () => {
    const none = calculate(makeWindyTwoSupport(0))
    const some = calculate(makeWindyTwoSupport(1500))
    const lots = calculate(makeWindyTwoSupport(9000))

    // Die Mindest-Ballast-Schwelle hängt nur von Geometrie/Wind ab, nicht vom
    // bereits eingetragenen losen Ballast.
    expect(some.minimumRequiredBallastTotalKg).toBeCloseTo(none.minimumRequiredBallastTotalKg, 0)
    expect(lots.minimumRequiredBallastTotalKg).toBeCloseTo(none.minimumRequiredBallastTotalKg, 0)
  })

  it('bei 0 vorhandenem Ballast entspricht die Schwelle dem Zusatzbedarf', () => {
    const r = calculate(makeWindyTwoSupport(0))
    expect(r.minimumRequiredBallastTotalKg).toBeCloseTo(r.requiredBallastTotalKg, 0)
  })

  it('bei reichlich Ballast ist Zusatzbedarf 0, die Mindest-Schwelle aber > 0 (man könnte reduzieren)', () => {
    const r = calculate(makeWindyTwoSupport(9000))
    expect(r.requiredBallastTotalKg).toBe(0)
    expect(r.minimumRequiredBallastTotalKg).toBeGreaterThan(0)
    // Mit 9 t vorhandenem Ballast ist die Schwelle deutlich kleiner → Reserve.
    expect(r.minimumRequiredBallastTotalKg).toBeLessThan(9000)
  })
})

describe('errors vs. proofFailures Trennung', () => {
  it('nicht standsicher (zu wenig Ballast) → proofFailures gefüllt, errors leer', () => {
    const r = calculate(makeWindyTwoSupport(0))
    expect(r.overallOk).toBe(false)
    // Die Rechnung lief fehlerfrei durch:
    expect(r.errors).toHaveLength(0)
    // …aber Nachweise sind nicht erfüllt:
    expect(r.proofFailures.length).toBeGreaterThan(0)
    expect(r.proofFailures.some(m => /Kippsicherheit|Gleitnachweis/.test(m))).toBe(true)
  })

  it('echte Eingabefehler landen in errors, nicht in proofFailures', () => {
    const broken: StructureInput = { ...makeBaseInput(), supports: [], beams: [] }
    const r = calculate(broken)
    expect(r.errors).toContain('Mindestens 2 Stützen erforderlich')
  })

  it('standsicher → beide Listen leer', () => {
    const r = calculate(makeWindyTwoSupport(9000))
    expect(r.errors).toHaveLength(0)
    expect(r.proofFailures).toHaveLength(0)
    expect(r.overallOk).toBe(true)
  })
})

describe('Betonblock-Ballast wird nicht doppelt gezählt', () => {
  function concreteSetup(): StructureInput {
    return {
      ...makeBaseInput(),
      supports: [
        { id: 'A', label: 'A', position: { x: 0, y: 0 }, trussType: 'PROLYTE_H40V', height: 4, footType: 'CONCRETE_BLOCK_1250', numberOfConcreteBlocks: 2, existingBallast: 0 },
        { id: 'B', label: 'B', position: { x: 5, y: 0 }, trussType: 'PROLYTE_H40V', height: 4, footType: 'CONCRETE_BLOCK_1250', numberOfConcreteBlocks: 2, existingBallast: 0 },
      ],
      beams: [],
    }
  }

  it('EQU-Reaktion entspricht einfachem Blockgewicht (2×1250 kg × γG,inf), nicht doppeltem', () => {
    const r = calculate(concreteSetup())
    const a = r.supports.find(s => s.supportId === 'A')!
    // 2500 kg × 9.81/1000 × 0.9 = 22.07 kN + kleiner Stützenanteil. Klar < 30 (nicht doppelt).
    expect(a.equVerticalReactionKN).toBeGreaterThan(20)
    expect(a.equVerticalReactionKN).toBeLessThan(25)
  })

  it('ballastPerSupport zeigt das Betonblockgewicht als vorhandenen Ballast (inkl. Fußsystem)', () => {
    const r = calculate(concreteSetup())
    const a = r.ballastPerSupport.find(b => b.supportId === 'A')!
    // 2 Blöcke = 2500 kg über das Fußsystem.
    expect(a.existingBallastKg).toBeCloseTo(2500, 0)
  })
})
