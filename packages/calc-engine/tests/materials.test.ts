import { describe, it, expect } from 'vitest'
import { TRUSS_DATABASE, getTrussProperties } from '../src/materials/database.js'
import type { TrussType } from '../src/types.js'

const ALL_TRUSS_TYPES: TrussType[] = [
  'PROLYTE_H30D',
  'PROLYTE_H30V',
  'PROLYTE_H40V',
  'PROLYTE_S40T',
  'PROLYTE_S52F',
  'EUROTRUSS_TD44',
  'EUROTRUSS_ST50',
  'PIPE_48_3_STEEL',
  'PIPE_50_3_ALU',
]

describe('Traversendatenbank', () => {
  it('alle TrussType-Einträge vorhanden', () => {
    for (const t of ALL_TRUSS_TYPES) {
      expect(TRUSS_DATABASE[t], `Fehlender Eintrag: ${t}`).toBeDefined()
    }
  })

  it('Prolyte H40V – verifizierte Werte aus CLAUDE.md', () => {
    const h40v = getTrussProperties('PROLYTE_H40V')
    expect(h40v.weightPerMeter).toBe(6.9)
    expect(h40v.crossSectionArea).toBe(16.96)
    expect(h40v.momentOfInertiaY).toBe(4917.1)
    expect(h40v.eModulus).toBe(7000.0)
    expect(h40v.bendingResistanceY).toBe(34.05)
    expect(h40v.shearResistanceZ).toBe(18.94)
    expect(h40v.normalForceResistance).toBe(50.22)
  })

  it('Prolyte H30D – verifizierte Werte aus CLAUDE.md', () => {
    const h30d = getTrussProperties('PROLYTE_H30D')
    expect(h30d.weightPerMeter).toBe(5.0)
    expect(h30d.momentOfInertiaY).toBe(1395.32)
    expect(h30d.momentOfInertiaZ).toBe(1849.29)
    expect(h30d.bendingResistanceY).toBe(10.39)
    expect(h30d.bendingResistanceZ).toBe(12.0)
  })

  it('Rohr Ø48.3×3.2 Stahl – verifizierte Werte aus CLAUDE.md', () => {
    const pipe = getTrussProperties('PIPE_48_3_STEEL')
    expect(pipe.weightPerMeter).toBe(3.56)
    expect(pipe.crossSectionArea).toBe(4.53)
    expect(pipe.momentOfInertiaY).toBe(10.78)
    expect(pipe.eModulus).toBe(21000.0)
    expect(pipe.material).toBe('STEEL_S235')
  })

  it('wirft Fehler bei unbekanntem Typ', () => {
    expect(() => getTrussProperties('UNKNOWN' as TrussType)).toThrow()
  })
})
