import { describe, expect, it } from 'vitest'
import { validateStructureInput } from '../src/validation.js'
import type { StructureInput } from '../src/types.js'

const baseInput: StructureInput = {
  projectName: 'Validation',
  eventName: 'Test',
  location: 'Köln',
  date: '2026-05-14',
  preparedBy: 'Codex',
  windZone: 2,
  terrainCategory: 'II',
  environment: 'OUTDOOR',
  frictionConfig: { mode: 'CUSTOM', customValue: 0.3 },
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
      position: { x: 6, y: 0 },
      trussType: 'PROLYTE_H40V',
      height: 5,
      footType: 'BASEPLATE',
      existingBallast: 0,
    },
  ],
  beams: [
    {
      id: 'T1',
      label: 'Traverse',
      startSupportId: 'A',
      endSupportId: 'B',
      trussType: 'PROLYTE_H40V',
      cantileverStart: 0,
      cantileverEnd: 0,
      loads: [],
      windSurfaces: [],
    },
  ],
}

describe('validateStructureInput', () => {
  it('meldet Stützenhöhe außerhalb 0,5 bis 20 m als Fehler', () => {
    const issues = validateStructureInput({
      ...baseInput,
      supports: [{ ...baseInput.supports[0]!, height: 0 }, baseInput.supports[1]!],
    })

    expect(issues).toContainEqual(
      expect.objectContaining({
        field: 'supports.0.height',
        severity: 'error',
        message: 'Höhe muss zwischen 0,5 und 20 m liegen.',
      }),
    )
  })

  it('erkennt doppelte Stützenpositionen', () => {
    const issues = validateStructureInput({
      ...baseInput,
      supports: [
        baseInput.supports[0]!,
        { ...baseInput.supports[1]!, position: { x: 0, y: 0 } },
      ],
    })

    expect(issues.some(issue => issue.field === 'supports.1.position' && issue.severity === 'error')).toBe(true)
  })

  it('warnt bei großer Spannweite und H30V über 8 m', () => {
    const issues = validateStructureInput({
      ...baseInput,
      supports: [
        baseInput.supports[0]!,
        { ...baseInput.supports[1]!, position: { x: 13, y: 0 } },
      ],
      beams: [{ ...baseInput.beams[0]!, trussType: 'PROLYTE_H30V' }],
    })

    expect(issues.filter(issue => issue.field === 'beams.0.span' && issue.severity === 'warning')).toHaveLength(2)
  })

  it('meldet Streckenlast außerhalb der Traversengeometrie als Fehler', () => {
    const issues = validateStructureInput({
      ...baseInput,
      beams: [
        {
          ...baseInput.beams[0]!,
          distributedLoads: [
            {
              id: 'D1',
              label: 'Kabel',
              startPositionM: 0,
              endPositionM: 8,
              loadKgPerM: 10,
            },
          ],
        },
      ],
    })

    expect(issues).toContainEqual(
      expect.objectContaining({
        field: 'beams.0.distributedLoads.0',
        severity: 'error',
      }),
    )
  })

  it('warnt bei Auskragung größer als halbe Spannweite', () => {
    const issues = validateStructureInput({
      ...baseInput,
      beams: [{ ...baseInput.beams[0]!, cantileverEnd: 4 }],
    })

    expect(issues).toContainEqual(
      expect.objectContaining({
        field: 'beams.0.cantileverEnd',
        severity: 'warning',
      }),
    )
  })
})
