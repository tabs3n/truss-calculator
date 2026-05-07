export * from './types.js'

import type {
  StructureInput,
  CalculationResult,
  BeamResult,
  SupportResult,
  WindLoadResult,
} from './types.js'

import { getPeakVelocityPressure, calculateWindForce } from './wind/windLoad.js'
import { getDesignLoad, getBeamSelfWeight, G, GAMMA_G, GAMMA_Q, DYNAMIC_FACTOR } from './loads/loadCombinations.js'
import { calculateBeam } from './beam/beamCalculation.js'
import { checkBeamUtilization } from './beam/utilizationCheck.js'
import { checkBuckling } from './stability/bucklingCheck.js'
import { calculateTippingAllDirections } from './tipping/tippingCheck.js'
import { checkSliding } from './sliding/slidingCheck.js'
import { getTrussProperties } from './materials/database.js'

/**
 * Hauptberechnungsfunktion – orchestriert alle Module.
 * Gibt ein vollständiges CalculationResult zurück.
 */
export function calculate(input: StructureInput): CalculationResult {
  const warnings: string[] = []
  const errors: string[] = []
  const normReferences = [
    'DIN EN 1991-1-4: Windlasten',
    'DIN EN 1993-1 (EC3): Stahlbau',
    'DIN EN 1999-1-1 (EC9): Aluminiumbau',
    'DIN EN 17879: Event-Strukturen',
    'DIN EN 13814: Reibbeiwerte',
    'DGUV Information 215-313: Dynamikzuschlag',
  ]

  if (input.supports.length < 2) {
    errors.push('Mindestens 2 Stützen erforderlich')
  }

  // ── Schritt 1: Windlast ──────────────────────────────────────────────────
  // Maßgebende Höhe = maximale Stützenhöhe
  const maxSupportHeight = Math.max(...input.supports.map(s => s.height))

  let windQp = 0
  try {
    windQp = getPeakVelocityPressure(input.windZone, input.terrainCategory, maxSupportHeight)
  } catch (e) {
    errors.push(`Windlastberechnung: ${(e as Error).message}`)
  }

  // Windkraft aus Flächen
  let totalWindAreaX = 0
  let totalWindAreaY = 0
  for (const beam of input.beams) {
    for (const ws of beam.windSurfaces) {
      totalWindAreaX += ws.width * ws.height
      totalWindAreaY += ws.width * ws.height
    }
  }
  // Traverseneigenwindfläche: konservativ Breite×Höhe aus Traversenbreite (ca. 0.4m) × Höhe
  // Stützenfläche (vereinfacht 0.4m Breite je Stütze)
  for (const support of input.supports) {
    totalWindAreaX += 0.4 * support.height
    totalWindAreaY += 0.4 * support.height
  }

  const windForceX = calculateWindForce(windQp, 1, 1) * totalWindAreaX
  const windForceY = windForceX // symmetrisch für rechteckige Aufstellung

  const windLoad: WindLoadResult = {
    peakVelocityPressure: windQp,
    referenceHeight: maxSupportHeight,
    windForceX,
    windForceY,
  }

  // ── Schritt 2: Auflagerkräfte (vereinfacht: gleichmäßige Verteilung) ─────
  // Eigengewichte Stützen
  let totalPermanentKN = 0
  for (const support of input.supports) {
    const props = getTrussProperties(support.trussType)
    const selfWeightKN = (props.weightPerMeter * support.height * 1.05 * G) / 1000
    totalPermanentKN += selfWeightKN * GAMMA_G
    totalPermanentKN += (support.existingBallast * G * GAMMA_G) / 1000
  }

  // Eigengewichte + Nutzlasten Traversen
  for (const beam of input.beams) {
    const startSupport = input.supports.find(s => s.id === beam.startSupportId)
    const endSupport = input.supports.find(s => s.id === beam.endSupportId)
    if (!startSupport || !endSupport) {
      errors.push(`Traverse ${beam.id}: Stütze nicht gefunden`)
      continue
    }
    const span = Math.sqrt(
      (endSupport.position.x - startSupport.position.x) ** 2 +
      (endSupport.position.y - startSupport.position.y) ** 2,
    )
    const totalLength = beam.cantileverStart + span + beam.cantileverEnd
    const selfWeightKN = getBeamSelfWeight(beam.trussType, totalLength)
    totalPermanentKN += selfWeightKN * GAMMA_G

    for (const load of beam.loads) {
      const loadKN = (load.weight * G) / 1000
      totalPermanentKN += getDesignLoad(loadKN, 'variable')
    }
  }

  // Gleichmäßige Verteilung auf alle Stützen
  const reactionPerSupport = totalPermanentKN / input.supports.length
  const supportVerticalReactions = new Map<string, number>(
    input.supports.map(s => [s.id, reactionPerSupport]),
  )

  // ── Schritt 3: Balkenberechnungen ────────────────────────────────────────
  const beamResults: BeamResult[] = []

  for (const beam of input.beams) {
    const startSupport = input.supports.find(s => s.id === beam.startSupportId)
    const endSupport = input.supports.find(s => s.id === beam.endSupportId)
    if (!startSupport || !endSupport) continue

    const span = Math.sqrt(
      (endSupport.position.x - startSupport.position.x) ** 2 +
      (endSupport.position.y - startSupport.position.y) ** 2,
    )

    const selfWeightPerMKNm = getBeamSelfWeight(beam.trussType, 1) * GAMMA_G
    const pointLoads = beam.loads.map(load => ({
      positionM: load.positionAlongBeam,
      forceKN: getDesignLoad((load.weight * G) / 1000, 'variable'),
    }))

    try {
      const forces = calculateBeam(
        beam.trussType,
        span,
        beam.cantileverStart,
        beam.cantileverEnd,
        pointLoads,
        selfWeightPerMKNm,
      )
      const utilization = checkBeamUtilization(beam.trussType, forces)

      beamResults.push({
        beamId: beam.id,
        maxBendingMomentKNm: forces.maxBendingMomentKNm,
        maxShearForceKN: forces.maxShearForceKN,
        bendingUtilization: utilization.bendingUtilization,
        shearUtilization: utilization.shearUtilization,
        maxDeflectionMm: forces.maxDeflectionMm,
        isOk: utilization.isOk,
        failureReason: utilization.failureReason,
      })

      if (!utilization.isOk) {
        errors.push(`Traverse ${beam.id}: ${utilization.failureReason}`)
      }
    } catch (e) {
      errors.push(`Traverse ${beam.id}: ${(e as Error).message}`)
    }
  }

  // ── Schritt 4: Knicknachweis Stützen ─────────────────────────────────────
  const supportResults: SupportResult[] = []

  for (const support of input.supports) {
    const Rz = supportVerticalReactions.get(support.id) ?? 0
    let bucklingUtil = 0
    let isOk = true
    let failureReason: string | undefined

    try {
      const buckling = checkBuckling(support.trussType, support.height, 2.0, Math.abs(Rz))
      bucklingUtil = buckling.utilization
      isOk = buckling.isOk
      if (!buckling.isOk) {
        failureReason = `Knicken: η=${bucklingUtil.toFixed(2)} > 1.0`
        errors.push(`Stütze ${support.id}: ${failureReason}`)
      }
    } catch (e) {
      errors.push(`Stütze ${support.id}: ${(e as Error).message}`)
      isOk = false
    }

    supportResults.push({
      supportId: support.id,
      verticalReactionKN: Rz,
      horizontalReactionXKN: windForceX / input.supports.length,
      horizontalReactionYKN: windForceY / input.supports.length,
      bucklingUtilization: bucklingUtil,
      isOk,
      failureReason,
    })
  }

  // ── Schritt 5: Kippsicherheit ─────────────────────────────────────────────
  const windAppHeight = maxSupportHeight * 0.6 // konservativ: 60% der Stützenhöhe
  const totalWindForce = Math.max(windForceX, windForceY)

  const tipping = calculateTippingAllDirections(
    input.supports,
    totalWindForce,
    windAppHeight,
    supportVerticalReactions,
  )

  // ── Schritt 6: Gleitnachweis ─────────────────────────────────────────────
  const totalVerticalKN = totalPermanentKN
  const sliding = checkSliding(totalWindForce, totalVerticalKN, input.frictionCoefficient)

  // ── Schritt 7: Ballast zusammenstellen ───────────────────────────────────
  const ballastKippen = tipping.governing.requiredBallastTotalKg
  const ballastGleiten = Math.max(0, sliding.requiredBallastKg)
  const requiredBallastTotalKg = Math.max(ballastKippen, ballastGleiten)

  // Pro Stütze: gleichmäßige Aufteilung
  const ballastPerSupport = input.supports.map(s => {
    const perSupport = requiredBallastTotalKg / input.supports.length
    return {
      supportId: s.id,
      supportLabel: s.label,
      requiredBallastKg: perSupport,
      existingBallastKg: s.existingBallast,
      additionalBallastNeededKg: Math.max(0, perSupport - s.existingBallast),
    }
  })

  const overallOk = errors.length === 0

  return {
    input,
    normReferences,
    windLoad,
    beams: beamResults,
    supports: supportResults,
    tipping,
    sliding,
    overallOk,
    requiredBallastTotalKg,
    ballastPerSupport,
    calculatedAt: new Date().toISOString(),
    warnings,
    errors,
  }
}
