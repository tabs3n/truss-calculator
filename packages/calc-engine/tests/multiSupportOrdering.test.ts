import { describe, expect, it } from 'vitest'

import { calculate } from '../src/index.js'
import type { StructureInput } from '../src/types.js'

function makeBaseInput(): StructureInput {
  return {
    projectName: 'Test',
    eventName: '-',
    location: 'Köln',
    date: '2026-05-14',
    preparedBy: 'tb',
    windZone: 1,
    terrainCategory: 'II',
    environment: 'OUTDOOR',
    frictionConfig: { mode: 'PRESET', preset: 'RUBBER_ON_CONCRETE' },
    supports: [],
    beams: [],
  }
}

/**
 * Sicherstellt, dass Multi-Support-Traversen die Zwischenstützen
 * defensiv nach Position entlang Start→Ende sortieren — auch wenn
 * die supportIds in beliebiger Reihenfolge übergeben wurden.
 */
describe('Multi-Support: defensive Sortierung der Zwischenstützen', () => {
  // Stützen über 7 m, aber in nicht-monotoner Reihenfolge nummeriert
  const supports = [
    { id: '1', label: '1', position: { x: 0, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 5, footType: 'BASEPLATE' as const, existingBallast: 1100, outriggerLength: 1.2 },
    { id: '2', label: '2', position: { x: 7, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 5, footType: 'BASEPLATE' as const, existingBallast: 1100, outriggerLength: 1.2 },
    { id: '3', label: '3', position: { x: 3.5, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 5, footType: 'BASEPLATE' as const, existingBallast: 1100, outriggerLength: 1.2 },
    { id: '4', label: '4', position: { x: 1.7, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 5, footType: 'BASEPLATE' as const, existingBallast: 1100, outriggerLength: 1.2 },
    { id: '5', label: '5', position: { x: 5.2, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 5, footType: 'BASEPLATE' as const, existingBallast: 1100, outriggerLength: 1.2 },
  ]

  it('zigzag supportIds [1,2,3,4,5] werden zu monotonen [1,4,3,5,2] sortiert', () => {
    // User-Reihenfolge entspricht ID-Reihenfolge, NICHT der x-Position
    const inputZigzag: StructureInput = {
      ...makeBaseInput(),
      supports,
      beams: [{
        id: 'B',
        label: 'B',
        startSupportId: '1',
        endSupportId: '2',
        supportIds: ['1', '2', '3', '4', '5'],  // zigzag-Reihenfolge!
        trussType: 'PROLYTE_H40V',
        cantileverStart: 0,
        cantileverEnd: 0,
        loads: [],
        windSurfaces: [],
      }],
    }

    // Identisches Setup, aber bereits korrekt sortiert
    const inputSorted: StructureInput = {
      ...makeBaseInput(),
      supports,
      beams: [{
        id: 'B',
        label: 'B',
        startSupportId: '1',
        endSupportId: '2',
        supportIds: ['1', '4', '3', '5', '2'],  // monoton: x = 0, 1.7, 3.5, 5.2, 7
        trussType: 'PROLYTE_H40V',
        cantileverStart: 0,
        cantileverEnd: 0,
        loads: [],
        windSurfaces: [],
      }],
    }

    const resultZigzag = calculate(inputZigzag)
    const resultSorted = calculate(inputSorted)

    // Beide müssen IDENTISCH rechnen, weil intern sortiert wird
    expect(resultZigzag.beams[0]!.maxBendingMomentKNm).toBeCloseTo(resultSorted.beams[0]!.maxBendingMomentKNm, 3)
    expect(resultZigzag.beams[0]!.maxShearForceKN).toBeCloseTo(resultSorted.beams[0]!.maxShearForceKN, 3)
    expect(resultZigzag.requiredBallastTotalKg).toBeCloseTo(resultSorted.requiredBallastTotalKg, 0)
  })

  it('Streckenlast über die volle 7-m-Spannweite landet komplett innerhalb der Stützen', () => {
    // 50 kg/m über 0 bis 7 m (volle Spannweite)
    const input: StructureInput = {
      ...makeBaseInput(),
      supports,
      beams: [{
        id: 'B',
        label: 'B',
        startSupportId: '1',
        endSupportId: '2',
        supportIds: ['1', '2', '3', '4', '5'],  // zigzag
        trussType: 'PROLYTE_H40V',
        cantileverStart: 0,
        cantileverEnd: 0,
        loads: [],
        distributedLoads: [{ id: 'D', label: 'Test', startPositionM: 0, endPositionM: 7, loadKgPerM: 50 }],
        windSurfaces: [],
      }],
    }

    const result = calculate(input)
    expect(result.errors).toHaveLength(0)
    // 50 kg/m × 7 m × 9.81 / 1000 × 1.8 (γQ × Dyn) ≈ 6.18 kN Bemessungs-Vertikallast
    // verteilt auf 5 Stützen mit Polyline-Reaktionsverteilung
    const totalReaction = result.supports.reduce((sum, s) => sum + s.verticalReactionKN, 0)
    expect(totalReaction).toBeGreaterThan(0)
  })
})
