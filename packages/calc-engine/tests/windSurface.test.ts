import { describe, expect, it } from 'vitest'
import type { StructureInput, WindSurface } from '../src/types.js'
import { calculateSurfaceWindForce, getDragCoefficient } from '../src/wind/windLoad.js'
import { resolveWindSurfaceGeometry } from '../src/wind/windSurfaceGeometry.js'

// Referenzfläche: 4 m × 3 m = 12 m², Normalvektor zeigt nach Nord (0°)
const bannerNorth: WindSurface = {
  id: 'b1',
  label: 'Testbanner Nord',
  width: 4,
  height: 3,
  centerHeightAboveGround: 5,
  surfaceType: 'BANNER_SOLID',
  surfaceOrientationDeg: 0,   // zeigt nach Nord/+Y
  dragCoefficient: 1.3,       // wird für BANNER_SOLID ignoriert
}

const QP = 0.8  // kN/m² – repräsentativer Böengeschwindigkeitsdruck

describe('getDragCoefficient – Typ-Standardwerte', () => {
  it('LED_WALL → cf = 1.3', () => {
    expect(getDragCoefficient({ ...bannerNorth, surfaceType: 'LED_WALL' })).toBe(1.3)
  })

  it('BANNER_SOLID → cf = 1.3', () => {
    expect(getDragCoefficient({ ...bannerNorth, surfaceType: 'BANNER_SOLID' })).toBe(1.3)
  })

  it('BANNER_MESH → cf = 0.6', () => {
    expect(getDragCoefficient({ ...bannerNorth, surfaceType: 'BANNER_MESH' })).toBe(0.6)
  })

  it('BANNER_MESH_OPEN → cf = 0.3', () => {
    expect(getDragCoefficient({ ...bannerNorth, surfaceType: 'BANNER_MESH_OPEN' })).toBe(0.3)
  })

  it('CUSTOM → gibt dragCoefficient-Feld zurück', () => {
    expect(getDragCoefficient({ ...bannerNorth, surfaceType: 'CUSTOM', dragCoefficient: 0.9 })).toBe(0.9)
  })
})

describe('resolveWindSurfaceGeometry - Banner im Truss-Rahmen', () => {
  it('leitet Breite, Höhe und Schwerpunkt aus oberer und unterer Traverse ab', () => {
    const input: StructureInput = {
      projectName: 'Rahmen',
      eventName: 'Test',
      location: 'Köln',
      date: '2026-05-21',
      preparedBy: 'Codex',
      windZone: 2,
      terrainCategory: 'II',
      environment: 'OUTDOOR',
      supports: [
        {
          id: 'S1',
          label: 'Links',
          position: { x: 0, y: 0 },
          trussType: 'PROLYTE_H30V',
          height: 5,
          footType: 'BASEPLATE',
          existingBallast: 0,
        },
        {
          id: 'S2',
          label: 'Rechts',
          position: { x: 6, y: 0 },
          trussType: 'PROLYTE_H30V',
          height: 5,
          footType: 'BASEPLATE',
          existingBallast: 0,
        },
      ],
      beams: [
        {
          id: 'TOP',
          label: 'Kopftraverse',
          startSupportId: 'S1',
          endSupportId: 'S2',
          trussType: 'PROLYTE_H30V',
          cantileverStart: 0,
          cantileverEnd: 0,
          loads: [],
          windSurfaces: [],
        },
        {
          id: 'BOTTOM',
          label: 'Untertraverse',
          startSupportId: 'S1',
          endSupportId: 'S2',
          trussType: 'PROLYTE_H30V',
          mountHeightM: 0.45,
          cantileverStart: 0,
          cantileverEnd: 0,
          loads: [],
          windSurfaces: [],
        },
      ],
      frictionConfig: { mode: 'CUSTOM', customValue: 0.3 },
    }
    const surface: WindSurface = {
      ...bannerNorth,
      frameMode: 'FILL_TRUSS_FRAME',
      bottomBeamId: 'BOTTOM',
      edgeInsetM: 0.05,
      width: 1,
      height: 1,
      centerHeightAboveGround: 1,
    }

    const resolved = resolveWindSurfaceGeometry(input, input.beams[0]!, surface)

    expect(resolved.width).toBeCloseTo(5.9, 6)
    expect(resolved.height).toBeCloseTo(4.45, 6)
    expect(resolved.centerHeightAboveGround).toBeCloseTo(2.725, 6)
  })
})

describe('calculateSurfaceWindForce – Richtungsabhängige Last', () => {
  describe('BANNER_SOLID, Orientierung 0° (Nord)', () => {
    it('Wind von Nord (0°) → volle Last: cf × qp × A × |cos(0)| = 1.3 × 0.8 × 12 × 1', () => {
      const force = calculateSurfaceWindForce(bannerNorth, 0, QP)
      expect(force).toBeCloseTo(1.3 * QP * 12 * 1.0, 6)
    })

    it('Wind von Süd (180°) → volle Last: |cos(180°)| = 1', () => {
      const force = calculateSurfaceWindForce(bannerNorth, 180, QP)
      expect(force).toBeCloseTo(1.3 * QP * 12 * 1.0, 6)
    })

    it('Wind von Ost (90°) → Mindestlast 30%: |cos(90°)| = 0, aber Böenminimum greift', () => {
      const force = calculateSurfaceWindForce(bannerNorth, 90, QP)
      expect(force).toBeCloseTo(1.3 * QP * 12 * 0.3, 6)
    })

    it('Wind von West (270°) → Mindestlast 30%', () => {
      const force = calculateSurfaceWindForce(bannerNorth, 270, QP)
      expect(force).toBeCloseTo(1.3 * QP * 12 * 0.3, 6)
    })

    it('Wind bei 45° → |cos(45°)| = 1/√2 ≈ 0.707 > 0.3, kein Minimum nötig', () => {
      const force = calculateSurfaceWindForce(bannerNorth, 45, QP)
      expect(force).toBeCloseTo(1.3 * QP * 12 * Math.SQRT1_2, 5)
    })
  })

  describe('LED_WALL – Mindestlast 30% wie BANNER_SOLID', () => {
    const ledWall: WindSurface = { ...bannerNorth, surfaceType: 'LED_WALL' }

    it('Wind von Ost (90°) → Mindestlast 30% greift', () => {
      const force = calculateSurfaceWindForce(ledWall, 90, QP)
      expect(force).toBeCloseTo(1.3 * QP * 12 * 0.3, 6)
    })

    it('Wind von Nord (0°) → volle Last', () => {
      const force = calculateSurfaceWindForce(ledWall, 0, QP)
      expect(force).toBeCloseTo(1.3 * QP * 12 * 1.0, 6)
    })
  })

  describe('BANNER_MESH (cf=0.6) – kein Mindestlastansatz', () => {
    const mesh: WindSurface = { ...bannerNorth, surfaceType: 'BANNER_MESH' }

    it('Wind von Nord (0°) → cf=0.6 statt 1.3 bei sonst gleicher Geometrie', () => {
      const solidForce = calculateSurfaceWindForce(bannerNorth, 0, QP)
      const meshForce  = calculateSurfaceWindForce(mesh, 0, QP)
      expect(meshForce / solidForce).toBeCloseTo(0.6 / 1.3, 5)
    })

    it('Wind von Ost (90°) → keine Mindestlast, Kraft ≈ 0', () => {
      const force = calculateSurfaceWindForce(mesh, 90, QP)
      expect(force).toBeCloseTo(0, 8)
    })
  })

  describe('BANNER_MESH_OPEN (cf=0.3) – kein Mindestlastansatz', () => {
    const openMesh: WindSurface = { ...bannerNorth, surfaceType: 'BANNER_MESH_OPEN' }

    it('Wind von Nord (0°) → cf=0.3', () => {
      const force = calculateSurfaceWindForce(openMesh, 0, QP)
      expect(force).toBeCloseTo(0.3 * QP * 12 * 1.0, 6)
    })

    it('Wind von Ost (90°) → keine Mindestlast, Kraft ≈ 0', () => {
      const force = calculateSurfaceWindForce(openMesh, 90, QP)
      expect(force).toBeCloseTo(0, 8)
    })
  })

  describe('CUSTOM – nutzt dragCoefficient-Feld', () => {
    const custom: WindSurface = { ...bannerNorth, surfaceType: 'CUSTOM', dragCoefficient: 0.9 }

    it('Wind von Nord (0°) → cf=0.9 × qp × A', () => {
      const force = calculateSurfaceWindForce(custom, 0, QP)
      expect(force).toBeCloseTo(0.9 * QP * 12 * 1.0, 6)
    })

    it('Wind von Ost (90°) → keine Mindestlast (CUSTOM), Kraft ≈ 0', () => {
      const force = calculateSurfaceWindForce(custom, 90, QP)
      expect(force).toBeCloseTo(0, 8)
    })
  })

  describe('Flächenorientierung 90° (Ost)', () => {
    const bannerEast: WindSurface = { ...bannerNorth, surfaceOrientationDeg: 90 }

    it('Wind von Ost (90°) → volle Last', () => {
      const force = calculateSurfaceWindForce(bannerEast, 90, QP)
      expect(force).toBeCloseTo(1.3 * QP * 12 * 1.0, 6)
    })

    it('Wind von Nord (0°) → Mindestlast 30%', () => {
      const force = calculateSurfaceWindForce(bannerEast, 0, QP)
      expect(force).toBeCloseTo(1.3 * QP * 12 * 0.3, 6)
    })
  })
})
