import { describe, expect, it } from 'vitest'

import { calculate } from '../src/index.js'
import { checkChordNode, checkCoupler, DEFAULT_COUPLER_WLL_KG } from '../src/connection/connectionCheck.js'
import type { StructureInput } from '../src/types.js'

function makeBaseInput(): StructureInput {
  return {
    projectName: 'Test', eventName: '-', location: 'Köln', date: '2026-05-29', preparedBy: 'tb',
    windZone: 1, terrainCategory: 'II', environment: 'INDOOR',
    frictionConfig: { mode: 'PRESET', preset: 'RUBBER_ON_CONCRETE' },
    supports: [], beams: [],
  }
}

describe('checkCoupler', () => {
  it('Last × Dynamikfaktor gegen WLL', () => {
    const r = checkCoupler(300, 500, 1.2) // 300×1.2 = 360 ≤ 500
    expect(r.actingKg).toBeCloseTo(360, 0)
    expect(r.utilization).toBeCloseTo(0.72, 2)
    expect(r.isOk).toBe(true)
  })
  it('Überlast → nicht OK', () => {
    const r = checkCoupler(500, 500, 1.2) // 600 > 500
    expect(r.isOk).toBe(false)
  })
})

describe('checkChordNode', () => {
  it('N/4 gegen Nch,Rd (H40V Nch=50.22 kN)', () => {
    const r = checkChordNode('PROLYTE_H40V', 80) // 80/4 = 20 kN
    expect(r.chordForceKN).toBeCloseTo(20, 1)
    expect(r.chordResistanceKN).toBeCloseTo(50.22, 1)
    expect(r.utilization).toBeCloseTo(20 / 50.22, 2)
    expect(r.isOk).toBe(true)
  })
  it('sehr hohe Auflagerkraft → Gurtrohr überlastet', () => {
    const r = checkChordNode('PROLYTE_H40V', 400) // 100 kN > 50.22
    expect(r.isOk).toBe(false)
  })
})

describe('Integration: Verbindungsnachweise im Gesamtergebnis', () => {
  function withLoad(weightKg: number, couplerWllKg?: number): StructureInput {
    return {
      ...makeBaseInput(),
      defaultCouplerWllKg: 500,
      supports: [
        { id: 'A', label: 'A', position: { x: 0, y: 0 }, trussType: 'PROLYTE_H40V', height: 4, footType: 'BASEPLATE', baseplateSize: 0.6, existingBallast: 0 },
        { id: 'B', label: 'B', position: { x: 5, y: 0 }, trussType: 'PROLYTE_H40V', height: 4, footType: 'BASEPLATE', baseplateSize: 0.6, existingBallast: 0 },
      ],
      beams: [{
        id: 'T', label: 'Top', startSupportId: 'A', endSupportId: 'B', trussType: 'PROLYTE_H40V',
        cantileverStart: 0, cantileverEnd: 0,
        loads: [{ id: 'L1', label: 'Mover', positionAlongBeam: 2.5, weight: weightKg, ...(couplerWllKg ? { couplerWllKg } : {}) }],
        windSurfaces: [],
      }],
    }
  }

  it('leichte Last → Kupplung OK, keine proofFailure', () => {
    const r = calculate(withLoad(100))
    const coupler = r.connections.find(c => c.kind === 'COUPLER')!
    expect(coupler.isOk).toBe(true)
    expect(r.proofFailures.some(m => /Kupplung/.test(m))).toBe(false)
  })

  it('schwere Last über WLL → Kupplung als proofFailure', () => {
    const r = calculate(withLoad(600)) // 600×1.2 = 720 > 500
    const coupler = r.connections.find(c => c.kind === 'COUPLER')!
    expect(coupler.isOk).toBe(false)
    expect(r.proofFailures.some(m => /Kupplung/.test(m))).toBe(true)
    expect(r.overallOk).toBe(false)
    expect(r.errors).toHaveLength(0)
  })

  it('per-Last couplerWllKg überschreibt Default', () => {
    const r = calculate(withLoad(600, 1000)) // WLL 1000 → 720 ≤ 1000 OK
    const coupler = r.connections.find(c => c.kind === 'COUPLER')!
    expect(coupler.capacityValue).toBe(1000)
    expect(coupler.isOk).toBe(true)
  })

  it('Gurtrohr-Knoten je Stütze ist enthalten', () => {
    const r = calculate(withLoad(100))
    const nodes = r.connections.filter(c => c.kind === 'NODE')
    expect(nodes.length).toBe(2)
    expect(nodes.every(n => n.unit === 'kN')).toBe(true)
  })

  it('Default-WLL greift ohne Angabe', () => {
    const input = withLoad(100)
    delete input.defaultCouplerWllKg
    const r = calculate(input)
    const coupler = r.connections.find(c => c.kind === 'COUPLER')!
    expect(coupler.capacityValue).toBe(DEFAULT_COUPLER_WLL_KG)
  })
})
