export * from './types'

import type {
  BeamResult,
  CalculationResult,
  SlidingResult,
  StructureInput,
  SupportResult,
  TippingDirectionResult,
  TippingResult,
  WindLoadResult,
} from './types'
import { getFrictionCoefficient } from './types'

import { calculateBeam } from './beam/beamCalculation'
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
import { getFootProperties, getFootWeightKg, getTrussProperties } from './materials/database'
import { checkSliding } from './sliding/slidingCheck'
import { checkBuckling } from './stability/bucklingCheck'
import { calculateTippingAllDirections } from './tipping/tippingCheck'
import { calculateSurfaceWindForce, calculateWindForce, getPeakVelocityPressure } from './wind/windLoad'

const normReferences = [
  'DIN EN 1991-1-4: Windlasten',
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
    for (const ws of beam.windSurfaces) {
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
  for (const support of input.supports) {
    const props = getTrussProperties(support.trussType)
    const selfWeightKN = (props.weightPerMeter * support.height * 1.05 * G) / 1000
    totalPermanentSTR_KN += selfWeightKN * GAMMA_G
    totalPermanentEQU_KN += selfWeightKN * GAMMA_G_INF

    const ballastKN = (support.existingBallast * G) / 1000
    totalPermanentSTR_KN += ballastKN * GAMMA_G
    totalPermanentEQU_KN += ballastKN * GAMMA_G_INF

    // Fußsystem-Eigengewicht: zählt als Ballast und ständige Last
    const footProps = getFootProperties(support.footType)
    if (footProps.countsAsBallast) {
      const footKN = (getFootWeightKg(support) * G) / 1000
      totalPermanentSTR_KN += footKN * GAMMA_G
      totalPermanentEQU_KN += footKN * GAMMA_G_INF
    }
  }
  for (const beam of input.beams) {
    const startSupport = input.supports.find(s => s.id === beam.startSupportId)
    const endSupport   = input.supports.find(s => s.id === beam.endSupportId)
    if (!startSupport || !endSupport) {
      errors.push(`Traverse ${beam.id}: Stütze nicht gefunden`)
      continue
    }
    const span = Math.hypot(
      endSupport.position.x - startSupport.position.x,
      endSupport.position.y - startSupport.position.y,
    )
    const totalLength = beam.cantileverStart + span + beam.cantileverEnd
    const beamSelfKN = getBeamSelfWeight(beam.trussType, totalLength)
    totalPermanentSTR_KN += beamSelfKN * GAMMA_G
    totalPermanentEQU_KN += beamSelfKN * GAMMA_G_INF
    for (const load of beam.loads) {
      const loadKN = (load.weight * G) / 1000
      totalPermanentSTR_KN += getDesignLoad(loadKN, 'variable')
      // EQU: veränderliche Lasten, die GÜNSTIG (stabilisierend) wirken,
      // werden nicht angesetzt (γQ,fav = 0).
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
    let windQp = 0
    try {
      windQp = getPeakVelocityPressure(input.windZone, input.terrainCategory, maxSupportHeight)
    } catch (error) {
      errors.push(`Windlastberechnung: ${(error as Error).message}`)
    }

    // Stützen-Querschnittsfläche ist omnidirektional (zylindrisch), einmalig berechnet
    const supportWindForceKN = input.supports.reduce(
      (sum, s) => sum + calculateWindForce(windQp, 0.4, s.height),
      0,
    )
    const allWindSurfaces = input.beams.flatMap(b => b.windSurfaces)
    const getWindForceKN = (compassAngleDeg: number): number =>
      allWindSurfaces.reduce(
        (sum, surface) => sum + calculateSurfaceWindForce(surface, compassAngleDeg, windQp),
        0,
      ) + supportWindForceKN

    const windForceX = getWindForceKN(90)  // Ostwind (+X)
    const windForceY = getWindForceKN(0)   // Nordwind (+Y)

    windLoad = {
      peakVelocityPressure: windQp,
      referenceHeight: maxSupportHeight,
      windForceX,
      windForceY,
    }
    totalHorizontalForceKN = Math.max(windForceX, windForceY)
    horizontalForceHeightM = maxSupportHeight * 0.6
    getHorizontalForceKN = getWindForceKN
  }

  // ── Auflagerkräfte (vereinfacht: gleichmäßige Verteilung) ───────────────────
  // STR: für Bauteilnachweise (Knicken). EQU: für Kipp-/Gleitnachweis (stabilisierend).
  const reactionPerSupportSTR = totalPermanentSTR_KN / input.supports.length
  const reactionPerSupportEQU = totalPermanentEQU_KN / input.supports.length
  const supportVerticalReactionsSTR = new Map<string, number>(
    input.supports.map(s => [s.id, reactionPerSupportSTR]),
  )
  const supportVerticalReactionsEQU = new Map<string, number>(
    input.supports.map(s => [s.id, reactionPerSupportEQU]),
  )

  // ── Traversennachweise ───────────────────────────────────────────────────────
  const beamResults: BeamResult[] = []
  for (const beam of input.beams) {
    const startSupport = input.supports.find(s => s.id === beam.startSupportId)
    const endSupport   = input.supports.find(s => s.id === beam.endSupportId)
    if (!startSupport || !endSupport) continue

    const span = Math.hypot(
      endSupport.position.x - startSupport.position.x,
      endSupport.position.y - startSupport.position.y,
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
        ...(utilization.failureReason ? { failureReason: utilization.failureReason } : {}),
      })
      if (!utilization.isOk) {
        errors.push(`Traverse ${beam.id}: ${utilization.failureReason}`)
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
  const designFactorHorizontal = isIndoor ? 1.0 : GAMMA_Q * DYNAMIC_FACTOR
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

    return {
      supportId: support.id,
      supportLabel: support.label,
      requiredBallastKg,
      existingBallastKg: support.existingBallast,
      additionalBallastNeededKg: Math.max(0, requiredBallastKg - support.existingBallast),
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
    designFactors: {
      gammaG: GAMMA_G,
      gammaGinf: GAMMA_G_INF,
      gammaQ: GAMMA_Q,
      dynamicFactor: DYNAMIC_FACTOR,
      gammaM1: GAMMA_M1,
      gammaM2: GAMMA_M2,
      horizontalDesignFactor: designFactorHorizontal,
    },
  }
}
