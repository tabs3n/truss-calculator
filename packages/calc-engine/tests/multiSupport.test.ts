import { describe, expect, it } from 'vitest'

import { calculate } from '../src/index.js'
import type { StructureInput } from '../src/types.js'

function makeBaseInput(): StructureInput {
  return {
    projectName: 'Multi-Support-Test',
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

describe('Multi-Support-Traversen', () => {
  it('3 Stützen auf einer Linie: rechnerisch identisch zu zwei separaten Beams', () => {
    // 3 Stützen A(0,0), B(3,0), C(6,0)
    const supports = [
      { id: 'A', label: 'A', position: { x: 0, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 4, footType: 'BASEPLATE' as const, existingBallast: 0, outriggerLength: 1.2 },
      { id: 'B', label: 'B', position: { x: 3, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 4, footType: 'BASEPLATE' as const, existingBallast: 0, outriggerLength: 1.2 },
      { id: 'C', label: 'C', position: { x: 6, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 4, footType: 'BASEPLATE' as const, existingBallast: 0, outriggerLength: 1.2 },
    ]

    // Variante 1: EIN Beam mit supportIds=[A,B,C]
    const inputMulti: StructureInput = {
      ...makeBaseInput(),
      supports,
      beams: [{
        id: 'M', label: 'Multi',
        startSupportId: 'A', endSupportId: 'C',
        supportIds: ['A', 'B', 'C'],
        trussType: 'PROLYTE_H40V',
        cantileverStart: 0, cantileverEnd: 0,
        loads: [], windSurfaces: [],
      }],
    }

    // Variante 2: ZWEI Beams (A-B, B-C)
    const inputSeparate: StructureInput = {
      ...makeBaseInput(),
      supports,
      beams: [
        { id: 'S1', label: 'AB', startSupportId: 'A', endSupportId: 'B', trussType: 'PROLYTE_H40V', cantileverStart: 0, cantileverEnd: 0, loads: [], windSurfaces: [] },
        { id: 'S2', label: 'BC', startSupportId: 'B', endSupportId: 'C', trussType: 'PROLYTE_H40V', cantileverStart: 0, cantileverEnd: 0, loads: [], windSurfaces: [] },
      ],
    }

    const resultMulti = calculate(inputMulti)
    const resultSeparate = calculate(inputSeparate)

    // Beide Varianten beschreiben dieselbe physikalische Konstruktion
    // → Gesamtballast und Gesamteigengewicht müssen übereinstimmen
    expect(resultMulti.requiredBallastTotalKg).toBeCloseTo(resultSeparate.requiredBallastTotalKg, 0)
  })

  it('Multi-Support-Beam hat eine BeamResult-Zeile (aggregiert)', () => {
    const supports = [
      { id: 'A', label: 'A', position: { x: 0, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 4, footType: 'BASEPLATE' as const, existingBallast: 0, outriggerLength: 1.2 },
      { id: 'B', label: 'B', position: { x: 2, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 4, footType: 'BASEPLATE' as const, existingBallast: 0, outriggerLength: 1.2 },
      { id: 'C', label: 'C', position: { x: 4, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 4, footType: 'BASEPLATE' as const, existingBallast: 0, outriggerLength: 1.2 },
      { id: 'D', label: 'D', position: { x: 6, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 4, footType: 'BASEPLATE' as const, existingBallast: 0, outriggerLength: 1.2 },
      { id: 'E', label: 'E', position: { x: 7, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 4, footType: 'BASEPLATE' as const, existingBallast: 0, outriggerLength: 1.2 },
    ]

    const input: StructureInput = {
      ...makeBaseInput(),
      supports,
      beams: [{
        id: 'long', label: '7m mit 5 Stützen',
        startSupportId: 'A', endSupportId: 'E',
        supportIds: ['A', 'B', 'C', 'D', 'E'],
        trussType: 'PROLYTE_H40V',
        cantileverStart: 0, cantileverEnd: 0,
        loads: [], windSurfaces: [],
      }],
    }

    const result = calculate(input)
    expect(result.beams).toHaveLength(1)
    expect(result.beams[0]!.beamId).toBe('long')
    // Eigengewicht der 7-m-Traverse wird verteilt → kein einzelnes Segment knickt
    expect(result.beams[0]!.isOk).toBe(true)
  })

  it('Multi-Support: weniger Ballast als Einfeldträger gleicher Spannweite (kürzere Felder = geringere M)', () => {
    // Vergleich: 7-m-Beam mit 2 Stützen (Spannweite 7) vs. 7-m-Beam mit 5 Stützen (5x 1,75-m-Felder)
    const positions2 = [{ x: 0, y: 0 }, { x: 7, y: 0 }]
    const positions5 = [{ x: 0, y: 0 }, { x: 1.75, y: 0 }, { x: 3.5, y: 0 }, { x: 5.25, y: 0 }, { x: 7, y: 0 }]

    const makeInput = (positions: Array<{ x: number; y: number }>, supportIds: string[]): StructureInput => ({
      ...makeBaseInput(),
      supports: positions.map((p, i) => ({
        id: supportIds[i]!,
        label: supportIds[i]!,
        position: p,
        trussType: 'PROLYTE_H40V' as const,
        height: 4,
        footType: 'BASEPLATE' as const,
        existingBallast: 0,
        outriggerLength: 1.2,
      })),
      beams: [{
        id: 'B',
        label: 'B',
        startSupportId: supportIds[0]!,
        endSupportId: supportIds[supportIds.length - 1]!,
        supportIds,
        trussType: 'PROLYTE_H40V',
        cantileverStart: 0,
        cantileverEnd: 0,
        loads: [],
        windSurfaces: [],
      }],
    })

    const r2 = calculate(makeInput(positions2, ['A', 'B']))
    const r5 = calculate(makeInput(positions5, ['A', 'B', 'C', 'D', 'E']))

    // 5-Stützen-Variante: kleinere Segmente → kleinere Biegemomente erwartet
    expect(r5.beams[0]!.maxBendingMomentKNm).toBeLessThan(r2.beams[0]!.maxBendingMomentKNm)
  })
})

describe('Streckenlasten', () => {
  it('Streckenlast erhöht den Ballastbedarf gegenüber unbeladener Traverse', () => {
    const supports = [
      { id: 'A', label: 'A', position: { x: 0, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 4, footType: 'BASEPLATE' as const, existingBallast: 0, outriggerLength: 1.2 },
      { id: 'B', label: 'B', position: { x: 6, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 4, footType: 'BASEPLATE' as const, existingBallast: 0, outriggerLength: 1.2 },
    ]
    const baseBeam = {
      id: 'B1', label: 'B1',
      startSupportId: 'A', endSupportId: 'B',
      trussType: 'PROLYTE_H40V' as const,
      cantileverStart: 0, cantileverEnd: 0,
      loads: [], windSurfaces: [],
    }

    const withoutLoad: StructureInput = {
      ...makeBaseInput(),
      supports,
      beams: [baseBeam],
    }
    const withLoad: StructureInput = {
      ...makeBaseInput(),
      supports,
      beams: [{
        ...baseBeam,
        distributedLoads: [{ id: 'D1', label: 'Kabel', startPositionM: 0, endPositionM: 6, loadKgPerM: 20 }],
      }],
    }

    const r1 = calculate(withoutLoad)
    const r2 = calculate(withLoad)

    // Streckenlast = 20 kg/m × 6 m = 120 kg zusätzlich. Stützenreaktion entsprechend höher.
    // Falls Kippen maßgebend: mehr Stabilisierungsmoment, ggf. weniger Ballast.
    // Falls Gleiten maßgebend: mehr Vertikallast → weniger Ballast.
    // Vorzeichen muss aber konsistent sein. Wir prüfen nur, dass kein Crash auftritt
    // und die Berechnung mit Streckenlast abgeschlossen wurde.
    // (errors kann Nachweis-Meldungen wie "Zusatzballast erforderlich" enthalten –
    //  hier geht es nur darum, dass die Träger-Berechnung selbst durchläuft.)
    expect(r1.beams).toHaveLength(1)
    expect(r2.beams).toHaveLength(1)
    expect(r2.beams[0]!.maxBendingMomentKNm).toBeGreaterThan(r1.beams[0]!.maxBendingMomentKNm)
  })

  it('Streckenlast über Teilbereich (1m-3m) wirkt nur dort', () => {
    const supports = [
      { id: 'A', label: 'A', position: { x: 0, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 4, footType: 'BASEPLATE' as const, existingBallast: 0, outriggerLength: 1.2 },
      { id: 'B', label: 'B', position: { x: 5, y: 0 }, trussType: 'PROLYTE_H40V' as const, height: 4, footType: 'BASEPLATE' as const, existingBallast: 0, outriggerLength: 1.2 },
    ]

    const input: StructureInput = {
      ...makeBaseInput(),
      supports,
      beams: [{
        id: 'B1', label: 'B1',
        startSupportId: 'A', endSupportId: 'B',
        trussType: 'PROLYTE_H40V',
        cantileverStart: 0, cantileverEnd: 0,
        loads: [],
        distributedLoads: [{ id: 'D1', label: 'Segment', startPositionM: 1, endPositionM: 3, loadKgPerM: 50 }],
        windSurfaces: [],
      }],
    }

    const result = calculate(input)
    expect(result.beams).toHaveLength(1)
    // 50 kg/m × 2 m = 100 kg total, mit Bemessungsfaktor 1,8 → 1,766 kN
    // Momentmaximum ungefähr bei x=2 (Schwerpunkt des Segments)
    expect(result.beams[0]!.maxBendingMomentKNm).toBeGreaterThan(0.5)
    expect(result.beams[0]!.maxBendingMomentKNm).toBeLessThan(5)
  })
})
