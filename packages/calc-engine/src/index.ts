export * from './types'

export * from './validation'
export * from './variants'
export * from './wind/windSurfaceGeometry'

import type {
  Beam,
  BeamResult,
  BeamSample,
  CalculationResult,
  SlidingResult,
  SnowLoadDetails,
  StructureInput,
  Support,
  SupportResult,
  TippingDirectionResult,
  TippingResult,
  WindLoadResult,
} from './types'
import { getFrictionCoefficient } from './types'

import { calculateBeam, type DistributedLoadSegment } from './beam/beamCalculation'
import { checkBeamUtilization } from './beam/utilizationCheck'
import {
  DYNAMIC_FACTOR,
  G,
  GAMMA_G,
  GAMMA_G_INF,
  GAMMA_M1,
  GAMMA_M2,
  GAMMA_Q,
  getBeamSelfWeight,
  getDesignLoad,
} from './loads/loadCombinations'
import { getGoverningIndoorLoad } from './loads/indoorLoads'
import { calculateSnowLoad } from './loads/snowLoad'
import { getFootProperties, getFootWeightKg, getTrussProperties } from './materials/database'
import { checkSliding } from './sliding/slidingCheck'
import { checkBuckling } from './stability/bucklingCheck'
import { calculateTippingAllDirections } from './tipping/tippingCheck'
import { calculateSurfaceWindForce, calculateWindForce, getDragCoefficient, getPeakVelocityPressure, getWindProbabilityFactor } from './wind/windLoad'
import { resolveAllWindSurfaces, resolveWindSurfacesForBeam } from './wind/windSurfaceGeometry'

const normReferences = [
  'DIN EN 1991-1-4: Windlasten',
  'DIN EN 1991-1-3: Schneelasten',
  'DIN EN 1993-1 (EC3): Stahlbau',
  'DIN EN 1999-1-1 (EC9): Aluminiumbau',
  'DIN EN 17879: Event-Strukturen',
  'DIN EN 13814: Reibbeiwerte',
  'DGUV Information 215-313: Dynamikzuschlag',
]

function emptyTippingDirection(): TippingDirectionResult {
  return {
    minVerticalReactionKN: 0,
    tippingAxisSupportIds: [],
    ballastSupportIds: [],
    requiredBallastPerSupportKg: 0,
    requiredBallastTotalKg: 0,
    utilization: Infinity,
    isOk: false,
    designHorizontalForceKN: 0,
    designTippingMomentKNm: 0,
    designStabilizingMomentKNm: 0,
    effectiveLeverArmM: 0,
    totalEquVerticalReactionKN: 0,
    applicationHeightM: 0,
  }
}

function emptyTippingResult(): TippingResult {
  return {
    directions: [],
    governing: emptyTippingDirection(),
    governingAngleDeg: 0,
  }
}

interface BeamGeometry {
  supportIds: string[]
  spans: number[]
  cumulativeX: number[]
  totalLengthM: number
}

function addToReactionMap(reactions: Map<string, number>, supportId: string, reactionKN: number) {
  reactions.set(supportId, (reactions.get(supportId) ?? 0) + reactionKN)
}

function getBeamSupportIds(beam: Beam): string[] {
  return beam.supportIds && beam.supportIds.length >= 2
    ? beam.supportIds
    : [beam.startSupportId, beam.endSupportId]
}

/**
 * Sortiert alle Stützen einer Multi-Support-Traverse defensiv entlang ihrer
 * Haupt-Achse, sodass die Polylinie monoton ist.
 *
 * Robust: Die beiden tatsächlichen geometrischen Endpunkte (das Stützenpaar
 * mit dem größten Abstand) definieren die Achse. Anschließend werden ALLE
 * Stützen nach ihrer Projektion auf diese Achse sortiert. Das schützt auch
 * dann vor Zickzack-Geometrie, wenn die übergebene Reihenfolge weder die
 * Endpunkte korrekt an den Rand stellt noch die Zwischenstützen ordnet.
 */
function orderSupportsAlongAxis(supports: Support[]): Support[] {
  if (supports.length < 3) return supports

  // Endpunkte = Stützenpaar mit größtem Abstand (O(n²), n klein)
  let endA = supports[0]!
  let endB = supports[1]!
  let maxDist2 = -1
  for (let i = 0; i < supports.length; i++) {
    for (let j = i + 1; j < supports.length; j++) {
      const a = supports[i]!
      const b = supports[j]!
      const d2 = (b.position.x - a.position.x) ** 2 + (b.position.y - a.position.y) ** 2
      if (d2 > maxDist2) {
        maxDist2 = d2
        endA = a
        endB = b
      }
    }
  }
  if (maxDist2 <= 0) return supports

  const vx = endB.position.x - endA.position.x
  const vy = endB.position.y - endA.position.y
  const len2 = vx * vx + vy * vy

  return [...supports].sort((s1, s2) => {
    const t1 = ((s1.position.x - endA.position.x) * vx + (s1.position.y - endA.position.y) * vy) / len2
    const t2 = ((s2.position.x - endA.position.x) * vx + (s2.position.y - endA.position.y) * vy) / len2
    return t1 - t2
  })
}

function resolveBeamGeometry(beam: Beam, supports: Support[]): BeamGeometry | null {
  const supportIds = getBeamSupportIds(beam)
  const beamSupports = supportIds
    .map(id => supports.find(s => s.id === id))
  if (beamSupports.some(s => !s)) return null
  const rawSupports = beamSupports.filter((s): s is Support => Boolean(s))
  if (rawSupports.length < 2) return null

  // Defensiv sortieren: bei nicht-monotoner Polylinie würde der Träger sonst
  // zickzack laufen und Längen/Lastpositionen unsinnig werden.
  const resolvedSupports = orderSupportsAlongAxis(rawSupports)
  const orderedIds = resolvedSupports.map(s => s.id)

  const spans: number[] = []
  const cumulativeX: number[] = [0]
  for (let i = 0; i < resolvedSupports.length - 1; i++) {
    const a = resolvedSupports[i]!
    const b = resolvedSupports[i + 1]!
    const span = Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y)
    spans.push(span)
    cumulativeX.push(cumulativeX[i]! + span)
  }

  const beamSpanTotal = spans.reduce((sum, span) => sum + span, 0)

  return {
    supportIds: orderedIds,
    spans,
    cumulativeX,
    totalLengthM: beam.cantileverStart + beamSpanTotal + beam.cantileverEnd,
  }
}

function getSegmentPointLoads(
  beam: Beam,
  segStart: number,
  segSpan: number,
  cantStart: number,
  cantEnd: number,
) {
  return beam.loads
    .map(load => ({
      positionM: load.positionAlongBeam - segStart,
      forceKN: getDesignLoad((load.weight * G) / 1000, 'variable'),
    }))
    .filter(load => {
      const min = -cantStart
      const max = segSpan + cantEnd
      return load.positionM >= min && load.positionM <= max
    })
}

function getSegmentDistributedLoads(
  beam: Beam,
  segStart: number,
  segEnd: number,
  cantStart: number,
  cantEnd: number,
): DistributedLoadSegment[] {
  const segMin = segStart - cantStart
  const segMax = segEnd + cantEnd

  return (beam.distributedLoads ?? [])
    .map(dl => {
      const clipStart = Math.max(dl.startPositionM, segMin)
      const clipEnd = Math.min(dl.endPositionM, segMax)
      if (clipEnd <= clipStart) return null
      return {
        startM: clipStart - segStart,
        endM: clipEnd - segStart,
        loadKNm: getDesignLoad((dl.loadKgPerM * G) / 1000, 'variable'),
      }
    })
    .filter((dl): dl is DistributedLoadSegment => dl !== null)
}

function addBeamReactionsToSupports(
  beam: Beam,
  geometry: BeamGeometry,
  supportVerticalReactionsSTR: Map<string, number>,
  supportVerticalReactionsEQU: Map<string, number>,
) {
  const selfWeightPerMSTR_KNm = getBeamSelfWeight(beam.trussType, 1) * GAMMA_G
  const selfWeightPerMEQU_KNm = getBeamSelfWeight(beam.trussType, 1) * GAMMA_G_INF

  for (let i = 0; i < geometry.spans.length; i++) {
    const segStart = geometry.cumulativeX[i]!
    const segEnd = geometry.cumulativeX[i + 1]!
    const segSpan = geometry.spans[i]!
    const isFirst = i === 0
    const isLast = i === geometry.spans.length - 1
    const cantStart = isFirst ? beam.cantileverStart : 0
    const cantEnd = isLast ? beam.cantileverEnd : 0

    const strForces = calculateBeam(
      beam.trussType,
      segSpan,
      cantStart,
      cantEnd,
      getSegmentPointLoads(beam, segStart, segSpan, cantStart, cantEnd),
      selfWeightPerMSTR_KNm,
      getSegmentDistributedLoads(beam, segStart, segEnd, cantStart, cantEnd),
    )
    addToReactionMap(supportVerticalReactionsSTR, geometry.supportIds[i]!, strForces.reactionStartKN)
    addToReactionMap(supportVerticalReactionsSTR, geometry.supportIds[i + 1]!, strForces.reactionEndKN)

    // DIN EN 1990 EQU: nur stabilisierende ständige Lasten mit γG,inf ansetzen.
    const equForces = calculateBeam(
      beam.trussType,
      segSpan,
      cantStart,
      cantEnd,
      [],
      selfWeightPerMEQU_KNm,
      [],
    )
    addToReactionMap(supportVerticalReactionsEQU, geometry.supportIds[i]!, equForces.reactionStartKN)
    addToReactionMap(supportVerticalReactionsEQU, geometry.supportIds[i + 1]!, equForces.reactionEndKN)
  }
}

function failedCalculationResult(
  input: StructureInput,
  warnings: string[],
  errors: string[],
): CalculationResult {
  let frictionCoefficientUsed = 0
  try { frictionCoefficientUsed = getFrictionCoefficient(input.frictionConfig) } catch {}
  return {
    input,
    normReferences,
    windLoad: {
      peakVelocityPressure: 0,
      referenceHeight: 0,
      windForceX: 0,
      windForceY: 0,
    },
    beams: [],
    supports: [],
    tipping: emptyTippingResult(),
    sliding: {
      resultingHorizontalForceKN: 0,
      requiredBallastKg: 0,
      isOk: false,
      frictionCoefficientUsed,
    },
    overallOk: false,
    requiredBallastTotalKg: 0,
    minimumRequiredBallastTotalKg: 0,
    ballastPerSupport: [],
    calculatedAt: new Date().toISOString(),
    warnings,
    errors,
    designFactors: {
      gammaG: GAMMA_G,
      gammaGinf: GAMMA_G_INF,
      gammaQ: GAMMA_Q,
      dynamicFactor: DYNAMIC_FACTOR,
      gammaM1: GAMMA_M1,
      gammaM2: GAMMA_M2,
      horizontalDesignFactor: 0,
      windProbabilityFactor: 1.0,
      windReturnPeriodYears: 50,
      applyDynamicFactorToWind: true,
    },
  }
}

/**
 * Hauptberechnungsfunktion: orchestriert Wind/Indoor-Ersatzlasten, Tragwerk,
 * Kippen, Gleiten und Ballast.
 */
export function calculate(input: StructureInput): CalculationResult {
  const warnings: string[] = []
  const errors: string[] = []

  if (input.supports.length < 2) {
    errors.push('Mindestens 2 Stützen erforderlich')
    return failedCalculationResult(input, warnings, errors)
  }

  const isIndoor = input.environment === 'INDOOR'
  const maxSupportHeight = Math.max(...input.supports.map(s => s.height))

  // ── Referenzfläche (für Wind und Indoor-Ersatzflächenlast) ──────────────────
  let totalWindAreaX = 0
  let totalWindAreaY = 0
  for (const beam of input.beams) {
    for (const ws of resolveWindSurfacesForBeam(input, beam)) {
      const area = ws.width * ws.height
      totalWindAreaX += area
      totalWindAreaY += area
    }
  }
  for (const support of input.supports) {
    totalWindAreaX += 0.4 * support.height
    totalWindAreaY += 0.4 * support.height
  }

  // ── Vertikallasten in zwei Bemessungssituationen ──────────────────────────
  // STR: Tragwerksnachweise (Beam, Knicken) → ungünstige Faktoren γG=1.35, γQ×Dyn=1.80
  // EQU: Lagesicherheit (Kippen, Gleiten) → günstige Faktoren γG,inf=0.90, γQ,fav=0
  let totalPermanentSTR_KN = 0
  let totalPermanentEQU_KN = 0
  const supportVerticalReactionsSTR = new Map<string, number>(
    input.supports.map(s => [s.id, 0]),
  )
  const supportVerticalReactionsEQU = new Map<string, number>(
    input.supports.map(s => [s.id, 0]),
  )
  for (const support of input.supports) {
    const props = getTrussProperties(support.trussType)
    const selfWeightKN = (props.weightPerMeter * support.height * 1.05 * G) / 1000
    const supportSelfWeightSTR = selfWeightKN * GAMMA_G
    const supportSelfWeightEQU = selfWeightKN * GAMMA_G_INF
    totalPermanentSTR_KN += supportSelfWeightSTR
    totalPermanentEQU_KN += supportSelfWeightEQU
    addToReactionMap(supportVerticalReactionsSTR, support.id, supportSelfWeightSTR)
    addToReactionMap(supportVerticalReactionsEQU, support.id, supportSelfWeightEQU)

    const ballastKN = (support.existingBallast * G) / 1000
    const ballastSTR = ballastKN * GAMMA_G
    const ballastEQU = ballastKN * GAMMA_G_INF
    totalPermanentSTR_KN += ballastSTR
    totalPermanentEQU_KN += ballastEQU
    addToReactionMap(supportVerticalReactionsSTR, support.id, ballastSTR)
    addToReactionMap(supportVerticalReactionsEQU, support.id, ballastEQU)

    // Fußsystem-Eigengewicht: zählt als Ballast und ständige Last
    const footProps = getFootProperties(support.footType)
    if (footProps.countsAsBallast) {
      const footKN = (getFootWeightKg(support) * G) / 1000
      const footSTR = footKN * GAMMA_G
      const footEQU = footKN * GAMMA_G_INF
      totalPermanentSTR_KN += footSTR
      totalPermanentEQU_KN += footEQU
      addToReactionMap(supportVerticalReactionsSTR, support.id, footSTR)
      addToReactionMap(supportVerticalReactionsEQU, support.id, footEQU)
    }
  }
  for (const beam of input.beams) {
    const geometry = resolveBeamGeometry(beam, input.supports)
    if (!geometry) {
      errors.push(`Traverse ${beam.id}: Stütze nicht gefunden`)
      continue
    }
    const totalLength = geometry.totalLengthM
    const beamSelfKN = getBeamSelfWeight(beam.trussType, totalLength)
    totalPermanentSTR_KN += beamSelfKN * GAMMA_G
    totalPermanentEQU_KN += beamSelfKN * GAMMA_G_INF
    for (const load of beam.loads) {
      const loadKN = (load.weight * G) / 1000
      totalPermanentSTR_KN += getDesignLoad(loadKN, 'variable')
      // EQU: veränderliche Lasten, die GÜNSTIG (stabilisierend) wirken,
      // werden nicht angesetzt (γQ,fav = 0).
    }
    // Streckenlasten
    for (const dl of beam.distributedLoads ?? []) {
      const length = Math.max(0, dl.endPositionM - dl.startPositionM)
      const totalKg = dl.loadKgPerM * length
      const totalKN = (totalKg * G) / 1000
      totalPermanentSTR_KN += getDesignLoad(totalKN, 'variable')
    }

    try {
      addBeamReactionsToSupports(
        beam,
        geometry,
        supportVerticalReactionsSTR,
        supportVerticalReactionsEQU,
      )
    } catch (error) {
      errors.push(`Traverse ${beam.id}: ${(error as Error).message}`)
    }
  }

  let snowLoad: SnowLoadDetails | undefined
  if (!isIndoor && input.snowConfig?.enabled) {
    try {
      const roofAreaM2 = Math.max(0, input.snowConfig.roofAreaM2 ?? 0)
      const snow = calculateSnowLoad({
        zone: input.snowConfig.zone,
        altitudeM: input.snowConfig.altitudeM,
        roofPitchDeg: input.snowConfig.roofPitchDeg,
        exposure: input.snowConfig.exposure,
      })
      const totalCharacteristicLoadKN = snow.roofLoadKNm2 * roofAreaM2
      // DIN EN 1990: Schneelast als veränderliche Last mit γQ und DGUV-Dynamikzuschlag ansetzen.
      const totalDesignLoadKN = getDesignLoad(totalCharacteristicLoadKN, 'variable')

      totalPermanentSTR_KN += totalDesignLoadKN
      if (input.supports.length > 0) {
        const snowReactionPerSupportKN = totalDesignLoadKN / input.supports.length
        for (const support of input.supports) {
          addToReactionMap(supportVerticalReactionsSTR, support.id, snowReactionPerSupportKN)
        }
      }

      snowLoad = {
        ...snow,
        roofAreaM2,
        totalCharacteristicLoadKN,
        totalDesignLoadKN,
      }
    } catch (error) {
      errors.push(`Schneelastberechnung: ${(error as Error).message}`)
    }
  }

  // ── Horizontalkraft und Windlast-Result ─────────────────────────────────────
  let windLoad: WindLoadResult
  let totalHorizontalForceKN: number
  let horizontalForceHeightM: number
  // Richtungsabhängige Windkraft in kN (Kompasswinkel). Indoor → konstant.
  let getHorizontalForceKN: (compassAngleDeg: number) => number = () => 0

  if (isIndoor) {
    const doorsCanOpen = input.indoorConfig?.doorsCanOpen ?? false
    const refArea = Math.max(totalWindAreaX, totalWindAreaY)

    try {
      const indoorLoad = getGoverningIndoorLoad(
        totalPermanentSTR_KN,
        maxSupportHeight,
        refArea,
        doorsCanOpen,
      )
      totalHorizontalForceKN = indoorLoad.forceKN
      horizontalForceHeightM = indoorLoad.applicationHeightM
      getHorizontalForceKN = () => indoorLoad.forceKN
      warnings.push(
        `Indoor (DIN EN 17879): maßgebend ${indoorLoad.governingCase} – Fh=${indoorLoad.forceKN.toFixed(2)} kN bei h=${indoorLoad.applicationHeightM.toFixed(1)} m`,
      )
    } catch (error) {
      errors.push(`Indoor-Lastberechnung: ${(error as Error).message}`)
      totalHorizontalForceKN = 0
      horizontalForceHeightM = maxSupportHeight
    }

    windLoad = {
      peakVelocityPressure: 0,
      referenceHeight: maxSupportHeight,
      windForceX: 0,
      windForceY: 0,
    }
  } else {
    // OUTDOOR: Windlast nach DIN EN 1991-1-4, richtungsabhängig je WindSurface
    const windReturnPeriod = input.windReturnPeriodYears ?? 50
    const windProbFactor = getWindProbabilityFactor(windReturnPeriod)
    let windQp = 0
    try {
      windQp = getPeakVelocityPressure(input.windZone, input.terrainCategory, maxSupportHeight) * windProbFactor
    } catch (error) {
      errors.push(`Windlastberechnung: ${(error as Error).message}`)
    }

    const allWindSurfaces = resolveAllWindSurfaces(input)

    // Stützen-Querschnittsfläche ist omnidirektional (zylindrisch), einmalig berechnet
    const supportWindForceKN = input.supports.reduce(
      (sum, s) => sum + calculateWindForce(windQp, 0.4, s.height),
      0,
    )
    const getWindForceKN = (compassAngleDeg: number): number =>
      allWindSurfaces.reduce(
        (sum, surface) => sum + calculateSurfaceWindForce(surface, compassAngleDeg, windQp),
        0,
      ) + supportWindForceKN

    const surfaceHeightWeight = allWindSurfaces.reduce(
      (sum, surface) => sum + getDragCoefficient(surface) * surface.width * surface.height,
      0,
    )
    const supportHeightWeight = input.supports.reduce(
      (sum, support) => sum + 1.3 * 0.4 * support.height,
      0,
    )
    const weightedHeightNumerator =
      allWindSurfaces.reduce(
        (sum, surface) =>
          sum + getDragCoefficient(surface) * surface.width * surface.height * surface.centerHeightAboveGround,
        0,
      ) +
      input.supports.reduce(
        (sum, support) => sum + 1.3 * 0.4 * support.height * (support.height / 2),
        0,
      )

    const windForceX = getWindForceKN(90)  // Ostwind (+X)
    const windForceY = getWindForceKN(0)   // Nordwind (+Y)

    windLoad = {
      peakVelocityPressure: windQp,
      referenceHeight: maxSupportHeight,
      windForceX,
      windForceY,
    }
    totalHorizontalForceKN = Math.max(windForceX, windForceY)
    horizontalForceHeightM = surfaceHeightWeight + supportHeightWeight > 0
      ? weightedHeightNumerator / (surfaceHeightWeight + supportHeightWeight)
      : maxSupportHeight * 0.6
    getHorizontalForceKN = getWindForceKN
  }

  // ── Auflagerkräfte aus echten Beam-Reactions ────────────────────────────────
  // STR: für Bauteilnachweise (Knicken). EQU: für Kipp-/Gleitnachweis (stabilisierend).

  // ── Traversennachweise ───────────────────────────────────────────────────────
  // Multi-Support-Traversen (>2 Stützen) werden als Aneinanderreihung von Einfeldträgern
  // berechnet (konservative Vereinfachung – überschätzt Momente gegenüber Durchlaufträger).
  const beamResults: BeamResult[] = []
  for (const beam of input.beams) {
    const geometry = resolveBeamGeometry(beam, input.supports)
    if (!geometry) continue

    const selfWeightPerMKNm = getBeamSelfWeight(beam.trussType, 1) * GAMMA_G

    // Aus der defensiv sortierten Geometrie (Polylinie monoton entlang Start→Ende)
    const spans = geometry.spans
    const cumulativeX = geometry.cumulativeX

    // Sammle für jedes Segment Punkt- und Streckenlasten, sowie Auskragungs-Beiträge
    let segmentMaxMoment = 0
    let segmentMaxShear = 0
    let segmentMaxDeflection = 0
    let governingSamples: BeamSample[] | undefined
    let aggregateUtilization = { bending: 0, shear: 0, isOk: true, failureReason: undefined as string | undefined }

    try {
      for (let i = 0; i < spans.length; i++) {
        const segStart = cumulativeX[i]!
        const segEnd   = cumulativeX[i + 1]!
        const segSpan  = spans[i]!
        const isFirst  = i === 0
        const isLast   = i === spans.length - 1
        const cantStart = isFirst ? beam.cantileverStart : 0
        const cantEnd   = isLast  ? beam.cantileverEnd   : 0

        // Punktlasten innerhalb des Segments (segStart - cantStart ≤ pos ≤ segEnd + cantEnd)
        // Position relativ zum SEGMENT-Anfang umrechnen: positionRelativ = positionAlongBeam - segStart
        const segPointLoads = beam.loads
          .map(load => {
            const positionM = load.positionAlongBeam - segStart
            return {
              positionM,
              forceKN: getDesignLoad((load.weight * G) / 1000, 'variable'),
              absPosition: load.positionAlongBeam,
            }
          })
          .filter(load => {
            const min = -cantStart
            const max = segSpan + cantEnd
            return load.positionM >= min && load.positionM <= max
          })
          .map(load => ({ positionM: load.positionM, forceKN: load.forceKN }))

        // Streckenlasten: pro Segment auf [segStart, segEnd] clippen (+ Auskragungen)
        const segMin = segStart - cantStart
        const segMax = segEnd + cantEnd
        const segDistributed = (beam.distributedLoads ?? [])
          .map(dl => {
            const clipStart = Math.max(dl.startPositionM, segMin)
            const clipEnd = Math.min(dl.endPositionM, segMax)
            if (clipEnd <= clipStart) return null
            const loadKNm = getDesignLoad((dl.loadKgPerM * G) / 1000, 'variable')
            return {
              startM: clipStart - segStart,
              endM: clipEnd - segStart,
              loadKNm,
            }
          })
          .filter((dl): dl is { startM: number; endM: number; loadKNm: number } => dl !== null)

        const forces = calculateBeam(
          beam.trussType,
          segSpan,
          cantStart,
          cantEnd,
          segPointLoads,
          selfWeightPerMKNm,
          segDistributed,
        )
        const utilization = checkBeamUtilization(beam.trussType, forces)
        const segmentSamples = forces.samples.map(sample => ({
          xM: sample.x + segStart,
          momentKNm: sample.momentKNm,
          shearKN: sample.shearKN,
          deflectionMm: sample.deflectionMm,
        }))

        // Aggregiere maximale Werte über alle Segmente
        if (forces.maxBendingMomentKNm > segmentMaxMoment) segmentMaxMoment = forces.maxBendingMomentKNm
        if (forces.maxShearForceKN > segmentMaxShear) segmentMaxShear = forces.maxShearForceKN
        if (forces.maxDeflectionMm > segmentMaxDeflection) segmentMaxDeflection = forces.maxDeflectionMm
        if (!governingSamples || utilization.bendingUtilization > aggregateUtilization.bending) {
          governingSamples = segmentSamples
        }
        if (utilization.bendingUtilization > aggregateUtilization.bending) aggregateUtilization.bending = utilization.bendingUtilization
        if (utilization.shearUtilization > aggregateUtilization.shear) aggregateUtilization.shear = utilization.shearUtilization
        if (!utilization.isOk) {
          aggregateUtilization.isOk = false
          if (!aggregateUtilization.failureReason) aggregateUtilization.failureReason = `Segment ${i + 1}: ${utilization.failureReason}`
        }
      }

      beamResults.push({
        beamId: beam.id,
        maxBendingMomentKNm: segmentMaxMoment,
        maxShearForceKN: segmentMaxShear,
        bendingUtilization: aggregateUtilization.bending,
        shearUtilization: aggregateUtilization.shear,
        maxDeflectionMm: segmentMaxDeflection,
        ...(governingSamples ? { samples: governingSamples } : {}),
        isOk: aggregateUtilization.isOk,
        ...(aggregateUtilization.failureReason ? { failureReason: aggregateUtilization.failureReason } : {}),
      })
      if (!aggregateUtilization.isOk) {
        errors.push(`Traverse ${beam.id}: ${aggregateUtilization.failureReason}`)
      }
    } catch (error) {
      errors.push(`Traverse ${beam.id}: ${(error as Error).message}`)
    }
  }

  // ── Stützennachweise (Knicken, STR) ──────────────────────────────────────────
  const horizontalPerSupport = totalHorizontalForceKN / input.supports.length
  const supportResults: SupportResult[] = []
  for (const support of input.supports) {
    const verticalReactionKN = supportVerticalReactionsSTR.get(support.id) ?? 0
    const equVerticalReactionKN = supportVerticalReactionsEQU.get(support.id) ?? 0
    let bucklingUtilization = 0
    let isOk = true
    let failureReason: string | undefined

    try {
      const buckling = checkBuckling(
        support.trussType,
        support.height,
        2,
        Math.abs(verticalReactionKN),
      )
      bucklingUtilization = buckling.utilization
      isOk = buckling.isOk
      if (!buckling.isOk) {
        failureReason = `Knicken: eta=${bucklingUtilization.toFixed(2)} > 1.0`
        errors.push(`Stütze ${support.id}: ${failureReason}`)
      }
    } catch (error) {
      failureReason = (error as Error).message
      errors.push(`Stütze ${support.id}: ${failureReason}`)
      isOk = false
    }

    supportResults.push({
      supportId: support.id,
      verticalReactionKN,
      equVerticalReactionKN,
      horizontalReactionXKN: horizontalPerSupport,
      horizontalReactionYKN: horizontalPerSupport,
      bucklingUtilization,
      isOk,
      ...(failureReason ? { failureReason } : {}),
    })
  }

  // ── Kippsicherheit (EQU, DIN EN 1990 Tab. A.1.2(A)) ──────────────────────────
  // Destabilisierende Horizontalkraft mit γQ × Dynamikzuschlag (Outdoor: Wind);
  // Indoor: Ersatzlast aus DIN EN 17879 ist bereits Bemessungswert.
  // applyDynamicFactorToWind=false: DGUV ×1.20 nicht auf Wind (qp enthält bereits Iv-Dynamik)
  const applyDGUVToWind = input.applyDynamicFactorToWind ?? true
  const designFactorHorizontal = isIndoor ? 1.0 : (applyDGUVToWind ? GAMMA_Q * DYNAMIC_FACTOR : GAMMA_Q)
  const getDesignHorizontalForceKN = (angleDeg: number): number =>
    getHorizontalForceKN(angleDeg) * designFactorHorizontal

  const tipping = calculateTippingAllDirections(
    input.supports,
    getDesignHorizontalForceKN,
    horizontalForceHeightM,
    supportVerticalReactionsEQU,  // stabilisierende ständige Lasten mit γG,inf
    input.windMode ?? 'AUTO',
    input.manualWindDirections,
  )

  if (!tipping.governing.isOk) {
    errors.push(
      `Kippsicherheit ${tipping.governingAngleDeg}°: eta=${tipping.governing.utilization.toFixed(2)}, Zusatzballast ${tipping.governing.requiredBallastTotalKg.toFixed(0)} kg`,
    )
  }

  // Für Gleitnachweis: maßgebende destabilisierende Horizontalkraft = max über alle Richtungen
  const totalDestabilizingHorizontalKN = tipping.directions.length > 0
    ? Math.max(...tipping.directions.map(d => getDesignHorizontalForceKN(d.angleDeg)))
    : totalHorizontalForceKN * designFactorHorizontal

  // ── Gleitnachweis (EQU: Fh,d destabilisierend, Fv,EQU stabilisierend) ────────
  let sliding: SlidingResult
  try {
    sliding = checkSliding(
      totalDestabilizingHorizontalKN,
      totalPermanentEQU_KN,
      input.frictionConfig,
    )
    if (!sliding.isOk) {
      errors.push(
        `Gleitnachweis: Zusatzballast ${Math.max(0, sliding.requiredBallastKg).toFixed(0)} kg erforderlich`,
      )
    }
  } catch (error) {
    errors.push(`Gleitnachweis: ${(error as Error).message}`)
    let frictionCoefficientUsed = 0
    try { frictionCoefficientUsed = getFrictionCoefficient(input.frictionConfig) } catch {}
    sliding = {
      resultingHorizontalForceKN: totalDestabilizingHorizontalKN,
      requiredBallastKg: 0,
      isOk: false,
      frictionCoefficientUsed,
    }
  }

  // ── Maßgebender Ballast ──────────────────────────────────────────────────────
  const ballastKippen = tipping.governing.requiredBallastTotalKg
  const ballastGleiten = Math.max(0, sliding.requiredBallastKg)
  const requiredBallastTotalKg = Math.max(ballastKippen, ballastGleiten)

  // ── Absoluter Mindest-Ballast (Schwelle, ohne losen Ballast) ─────────────────
  // Identische Kipp-/Gleit-Rechnung, aber mit Reaktionen OHNE existingBallast.
  // Ergebnis = wie viel loser Ballast (Wasser/Gewichte) bei optimaler Platzierung
  // mindestens nötig ist. Fußsystem-Eigengewicht (Betonblöcke) bleibt enthalten.
  const reactionsEQU_noLoose = new Map(supportVerticalReactionsEQU)
  let totalPermanentEQU_noLoose_KN = totalPermanentEQU_KN
  for (const support of input.supports) {
    const looseBallastEQU_KN = ((support.existingBallast * G) / 1000) * GAMMA_G_INF
    reactionsEQU_noLoose.set(
      support.id,
      (reactionsEQU_noLoose.get(support.id) ?? 0) - looseBallastEQU_KN,
    )
    totalPermanentEQU_noLoose_KN -= looseBallastEQU_KN
  }

  let minimumRequiredBallastTotalKg = 0
  try {
    const tippingMin = calculateTippingAllDirections(
      input.supports,
      getDesignHorizontalForceKN,
      horizontalForceHeightM,
      reactionsEQU_noLoose,
      input.windMode ?? 'AUTO',
      input.manualWindDirections,
    )
    const slidingMin = checkSliding(
      totalDestabilizingHorizontalKN,
      totalPermanentEQU_noLoose_KN,
      input.frictionConfig,
    )
    minimumRequiredBallastTotalKg = Math.max(
      tippingMin.governing.requiredBallastTotalKg,
      Math.max(0, slidingMin.requiredBallastKg),
    )
  } catch {
    // Fällt auf den Zusatzbedarf zurück, falls die Min-Rechnung scheitert.
    minimumRequiredBallastTotalKg = requiredBallastTotalKg
  }
  const tippingBallastSupportIds = new Set(
    tipping.governing.ballastSupportIds.length > 0
      ? tipping.governing.ballastSupportIds
      : input.supports.map(s => s.id),
  )
  const tippingGoverns = ballastKippen >= ballastGleiten && ballastKippen > 0

  const ballastPerSupport = input.supports.map(support => {
    const requiredBallastKg = tippingGoverns
      ? tippingBallastSupportIds.has(support.id)
        ? tipping.governing.requiredBallastPerSupportKg
        : 0
      : requiredBallastTotalKg / input.supports.length

    // Vorhandener stabilisierender Ballast = loser Ballast (existingBallast)
    // + Fußsystem-Eigengewicht, sofern es als Ballast zählt (z.B. Betonblöcke).
    const footProps = getFootProperties(support.footType)
    const footBallastKg = footProps.countsAsBallast ? getFootWeightKg(support) : 0
    const existingBallastKg = support.existingBallast + footBallastKg

    return {
      supportId: support.id,
      supportLabel: support.label,
      requiredBallastKg,
      existingBallastKg,
      additionalBallastNeededKg: requiredBallastKg,
    }
  })

  const overallOk =
    errors.length === 0 &&
    beamResults.every(r => r.isOk) &&
    supportResults.every(r => r.isOk) &&
    tipping.governing.isOk &&
    sliding.isOk

  return {
    input,
    normReferences,
    windLoad,
    ...(snowLoad ? { snowLoad } : {}),
    beams: beamResults,
    supports: supportResults,
    tipping,
    sliding,
    overallOk,
    requiredBallastTotalKg,
    minimumRequiredBallastTotalKg,
    ballastPerSupport,
    calculatedAt: new Date().toISOString(),
    warnings,
    errors,
    designFactors: {
      gammaG: GAMMA_G,
      gammaGinf: GAMMA_G_INF,
      gammaQ: GAMMA_Q,
      dynamicFactor: DYNAMIC_FACTOR,
      gammaM1: GAMMA_M1,
      gammaM2: GAMMA_M2,
      horizontalDesignFactor: designFactorHorizontal,
      windProbabilityFactor: isIndoor ? 1.0 : (getWindProbabilityFactor(input.windReturnPeriodYears ?? 50)),
      windReturnPeriodYears: isIndoor ? 50 : (input.windReturnPeriodYears ?? 50),
      applyDynamicFactorToWind: applyDGUVToWind,
    },
  }
}
