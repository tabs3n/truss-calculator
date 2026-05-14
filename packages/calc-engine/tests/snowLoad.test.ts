import { describe, expect, it } from 'vitest'

import {
  calculateSnowLoad,
  getCharacteristicSnowLoad,
  getShapeFactor,
} from '../src/loads/snowLoad.js'

describe('Schneelast nach DIN EN 1991-1-3', () => {
  describe('Charakteristische Bodenschneelast s_k', () => {
    it('Zone 1, Höhe 0 m: Mindestwert 0,65 kN/m²', () => {
      expect(getCharacteristicSnowLoad('1', 0)).toBeCloseTo(0.65, 2)
    })

    it('Zone 1, 200 m über NN: > Mindestwert', () => {
      // s_k = 0,19 + 0,91 × ((200+140)/760)² = 0,19 + 0,91 × 0,2 ≈ 0,372
      // Mindestwert 0,65 greift weiterhin
      expect(getCharacteristicSnowLoad('1', 200)).toBe(0.65)
    })

    it('Zone 2, 500 m über NN: Formel-Wert > Mindestwert', () => {
      // s_k = 0,25 + 1,91 × ((500+140)/760)² ≈ 0,25 + 1,91 × 0,709 ≈ 1,604
      const result = getCharacteristicSnowLoad('2', 500)
      expect(result).toBeGreaterThan(0.85)
      expect(result).toBeCloseTo(1.604, 2)
    })

    it('Zone 3 stets ≥ 1,10 kN/m²', () => {
      expect(getCharacteristicSnowLoad('3', 0)).toBeGreaterThanOrEqual(1.10)
      expect(getCharacteristicSnowLoad('3', 100)).toBeGreaterThanOrEqual(1.10)
    })

    it('wirft Fehler bei ungültiger Höhe', () => {
      expect(() => getCharacteristicSnowLoad('1', -10)).toThrow()
      expect(() => getCharacteristicSnowLoad('1', 2000)).toThrow()
    })
  })

  describe('Formbeiwert μ_i', () => {
    it('Flachdach (0°): μ = 0,8', () => {
      expect(getShapeFactor(0)).toBe(0.8)
    })

    it('30° Neigung: noch μ = 0,8', () => {
      expect(getShapeFactor(30)).toBe(0.8)
    })

    it('45° Neigung: μ = 0,8 × (60−45)/30 = 0,4', () => {
      expect(getShapeFactor(45)).toBeCloseTo(0.4, 2)
    })

    it('60° und steiler: μ = 0 (Schnee rutscht ab)', () => {
      expect(getShapeFactor(60)).toBe(0)
      expect(getShapeFactor(75)).toBe(0)
    })
  })

  describe('Gesamtberechnung calculateSnowLoad', () => {
    it('Köln (Zone 1, 50 m, Flachdach, normal): s ≈ 0,52 kN/m²', () => {
      const result = calculateSnowLoad({
        zone: '1',
        altitudeM: 50,
        roofPitchDeg: 0,
        exposure: 'NORMAL',
      })
      expect(result.shapeFactor).toBe(0.8)
      expect(result.exposureFactor).toBe(1.0)
      expect(result.thermalFactor).toBe(1.0)
      expect(result.characteristicGroundLoadKNm2).toBe(0.65)
      // s = 0,8 × 1,0 × 1,0 × 0,65 = 0,52
      expect(result.roofLoadKNm2).toBeCloseTo(0.52, 2)
    })

    it('Alpenrand (Zone 3, 800 m, Flachdach, windig): hohe Last erwartet', () => {
      const result = calculateSnowLoad({
        zone: '3',
        altitudeM: 800,
        roofPitchDeg: 0,
        exposure: 'WINDIG',
      })
      expect(result.exposureFactor).toBe(0.8)
      // s_k ≈ 0,31 + 2,91 × ((800+140)/760)² ≈ 0,31 + 2,91 × 1,529 ≈ 4,76
      expect(result.characteristicGroundLoadKNm2).toBeGreaterThan(4.5)
      expect(result.roofLoadKNm2).toBeGreaterThan(2.8)
    })

    it('Steildach 45° reduziert die Last', () => {
      const flat = calculateSnowLoad({ zone: '2', altitudeM: 300, roofPitchDeg: 0 })
      const steep = calculateSnowLoad({ zone: '2', altitudeM: 300, roofPitchDeg: 45 })
      expect(steep.roofLoadKNm2).toBeLessThan(flat.roofLoadKNm2)
      expect(steep.roofLoadKNm2 / flat.roofLoadKNm2).toBeCloseTo(0.4 / 0.8, 2)
    })

    it('Windige Lage reduziert die Last gegenüber geschützter', () => {
      const windy = calculateSnowLoad({ zone: '2', altitudeM: 200, exposure: 'WINDIG' })
      const sheltered = calculateSnowLoad({ zone: '2', altitudeM: 200, exposure: 'GESCHUETZT' })
      expect(windy.roofLoadKNm2).toBeLessThan(sheltered.roofLoadKNm2)
    })
  })
})
