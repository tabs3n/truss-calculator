import type { TrussType } from '../types'
import { getTrussProperties } from '../materials/database'

export interface BeamInternalForces {
  maxBendingMomentKNm: number
  positionOfMaxMomentM: number
  reactionStartKN: number
  reactionEndKN: number
  maxShearForceKN: number
  maxDeflectionMm: number
}

interface MomentSample {
  x: number
  momentKNm: number
}

interface DeflectionSample extends MomentSample {
  rawDeflectionM: number
}

function interpolateDeflection(samples: DeflectionSample[], targetX: number) {
  const first = samples[0]
  const last = samples[samples.length - 1]
  if (!first || !last) return 0
  if (targetX <= first.x) return first.rawDeflectionM
  if (targetX >= last.x) return last.rawDeflectionM

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]!
    const current = samples[index]!
    if (targetX <= current.x) {
      const ratio = (targetX - previous.x) / (current.x - previous.x || 1)
      return previous.rawDeflectionM + (current.rawDeflectionM - previous.rawDeflectionM) * ratio
    }
  }

  return last.rawDeflectionM
}

function calculateMaxDeflectionMm(momentSamples: MomentSample[], spanM: number, eiKNm2: number) {
  if (eiKNm2 <= 0 || momentSamples.length < 2) return 0

  const deflectionSamples: DeflectionSample[] = []
  let rotation = 0
  let rawDeflection = 0

  for (let index = 0; index < momentSamples.length; index += 1) {
    const sample = momentSamples[index]!
    if (index > 0) {
      const previous = momentSamples[index - 1]!
      const dx = sample.x - previous.x
      const previousCurvature = previous.momentKNm / eiKNm2
      const currentCurvature = sample.momentKNm / eiKNm2
      const nextRotation = rotation + ((previousCurvature + currentCurvature) / 2) * dx
      rawDeflection += ((rotation + nextRotation) / 2) * dx
      rotation = nextRotation
    }

    deflectionSamples.push({
      ...sample,
      rawDeflectionM: rawDeflection,
    })
  }

  const supportDeflectionA = interpolateDeflection(deflectionSamples, 0)
  const supportDeflectionB = interpolateDeflection(deflectionSamples, spanM)
  let maxDeflectionM = 0

  for (const sample of deflectionSamples) {
    const supportChordM = supportDeflectionA + ((supportDeflectionB - supportDeflectionA) * sample.x) / spanM
    maxDeflectionM = Math.max(maxDeflectionM, Math.abs(sample.rawDeflectionM - supportChordM))
  }

  return maxDeflectionM * 1000
}

/**
 * Balkenberechnung mit Gleichgewicht und numerischer Integration der Krümmung.
 * Koordinatensystem: x=0 am linken Auflager, x=L am rechten Auflager.
 * Linke Auskragungen liegen bei x<0, rechte Auskragungen bei x>L.
 */
export function calculateBeam(
  trussType: TrussType,
  spanM: number,
  cantileverStartM: number,
  cantileverEndM: number,
  pointLoads: { positionM: number; forceKN: number }[],
  distributedLoadKNm: number,
): BeamInternalForces {
  if (spanM <= 0) throw new Error(`Ungültige Stützweite: ${spanM} m`)
  if (cantileverStartM < 0 || cantileverEndM < 0) {
    throw new Error('Auskragungen duerfen nicht negativ sein')
  }

  const props = getTrussProperties(trussType)
  const span = spanM

  let sumMomentsAroundA = 0
  let sumVerticalLoads = 0

  for (const load of pointLoads) {
    sumMomentsAroundA += load.forceKN * load.positionM
    sumVerticalLoads += load.forceKN
  }

  const totalLength = cantileverStartM + span + cantileverEndM
  const totalDistributed = distributedLoadKNm * totalLength
  const centroidOfDistributed = -cantileverStartM + totalLength / 2
  sumMomentsAroundA += totalDistributed * centroidOfDistributed
  sumVerticalLoads += totalDistributed

  const reactionEnd = sumMomentsAroundA / span
  const reactionStart = sumVerticalLoads - reactionEnd

  const segments = 1000
  const xStart = -cantileverStartM
  const xEnd = span + cantileverEndM
  const dx = (xEnd - xStart) / segments

  let maxMoment = 0
  let posOfMaxMoment = 0
  let maxShear = 0
  const momentSamples: MomentSample[] = []

  for (let index = 0; index <= segments; index += 1) {
    const x = xStart + index * dx

    let shearKN = -distributedLoadKNm * (x - xStart)
    if (x >= 0) shearKN += reactionStart
    if (x >= span) shearKN -= reactionEnd
    for (const load of pointLoads) {
      if (x >= load.positionM) shearKN -= load.forceKN
    }

    let momentKNm = -distributedLoadKNm * (x - xStart) ** 2 / 2
    if (x >= 0) momentKNm += reactionStart * x
    if (x >= span) momentKNm -= reactionEnd * (x - span)
    for (const load of pointLoads) {
      if (x >= load.positionM) momentKNm -= load.forceKN * (x - load.positionM)
    }

    momentSamples.push({ x, momentKNm })

    if (Math.abs(momentKNm) > Math.abs(maxMoment)) {
      maxMoment = momentKNm
      posOfMaxMoment = x
    }
    if (Math.abs(shearKN) > Math.abs(maxShear)) {
      maxShear = shearKN
    }
  }

  const eiKNm2 = props.eModulus * props.momentOfInertiaY * 1e-4

  return {
    maxBendingMomentKNm: Math.abs(maxMoment),
    positionOfMaxMomentM: posOfMaxMoment,
    reactionStartKN: reactionStart,
    reactionEndKN: reactionEnd,
    maxShearForceKN: Math.abs(maxShear),
    maxDeflectionMm: calculateMaxDeflectionMm(momentSamples, span, eiKNm2),
  }
}
