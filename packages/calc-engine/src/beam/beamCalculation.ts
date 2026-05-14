import type { TrussType } from '../types'
import { getTrussProperties } from '../materials/database'

export interface BeamInternalForces {
  maxBendingMomentKNm: number
  positionOfMaxMomentM: number
  reactionStartKN: number
  reactionEndKN: number
  maxShearForceKN: number
  maxDeflectionMm: number
  samples: BeamForceSample[]
}

export interface BeamForceSample {
  x: number
  momentKNm: number
  shearKN: number
  deflectionMm: number
}

interface MomentSample {
  x: number
  momentKNm: number
}

interface ForceSample extends MomentSample {
  shearKN: number
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

function calculateDeflectionResult(samples: ForceSample[], spanM: number, eiKNm2: number) {
  if (eiKNm2 <= 0 || samples.length < 2) {
    return {
      maxDeflectionMm: 0,
      samples: samples.map(sample => ({ ...sample, deflectionMm: 0 })),
    }
  }

  const deflectionSamples: DeflectionSample[] = []
  let rotation = 0
  let rawDeflection = 0

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]!
    if (index > 0) {
      const previous = samples[index - 1]!
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
  const samplesWithDeflection: BeamForceSample[] = []

  for (let index = 0; index < deflectionSamples.length; index += 1) {
    const sample = deflectionSamples[index]!
    const forceSample = samples[index]!
    const supportChordM = supportDeflectionA + ((supportDeflectionB - supportDeflectionA) * sample.x) / spanM
    const deflectionM = sample.rawDeflectionM - supportChordM
    maxDeflectionM = Math.max(maxDeflectionM, Math.abs(deflectionM))
    samplesWithDeflection.push({
      x: forceSample.x,
      momentKNm: forceSample.momentKNm,
      shearKN: forceSample.shearKN,
      deflectionMm: deflectionM * 1000,
    })
  }

  return {
    maxDeflectionMm: maxDeflectionM * 1000,
    samples: samplesWithDeflection,
  }
}

function downsampleForceSamples(samples: BeamForceSample[], maxSamples = 51) {
  if (samples.length <= maxSamples) return samples

  const result: BeamForceSample[] = []
  const usedIndices = new Set<number>()
  const step = (samples.length - 1) / (maxSamples - 1)

  for (let index = 0; index < maxSamples; index += 1) {
    const sampleIndex = Math.round(index * step)
    if (usedIndices.has(sampleIndex)) continue
    usedIndices.add(sampleIndex)
    result.push(samples[sampleIndex]!)
  }

  return result
}

export interface DistributedLoadSegment {
  startM: number    // x-Position vom linken Auflager
  endM: number      // x-Position vom linken Auflager (> startM)
  loadKNm: number   // kN/m (positiv = nach unten wirkend)
}

/**
 * Hilfsfunktion: Beitrag eines Streckenlastsegments [a,b] mit Intensität q (kN/m) zur
 * Schubkraft an Position x (Aufsummierung von links nach rechts).
 */
function distributedShearAtX(segments: DistributedLoadSegment[], x: number): number {
  let shear = 0
  for (const seg of segments) {
    if (x <= seg.startM) continue
    const xEffective = Math.min(x, seg.endM)
    shear -= seg.loadKNm * (xEffective - seg.startM)
  }
  return shear
}

/**
 * Hilfsfunktion: Beitrag eines Streckenlastsegments [a,b] mit Intensität q (kN/m) zum
 * Biegemoment an Position x.
 */
function distributedMomentAtX(segments: DistributedLoadSegment[], x: number): number {
  let moment = 0
  for (const seg of segments) {
    if (x <= seg.startM) continue
    if (x <= seg.endM) {
      // Innerhalb des Segments: M(x) = -q × (x-a)² / 2
      moment -= seg.loadKNm * (x - seg.startM) ** 2 / 2
    } else {
      // Hinter dem Segment: voller Block, Schwerpunkt bei (a+b)/2
      const length = seg.endM - seg.startM
      const centroid = (seg.startM + seg.endM) / 2
      moment -= seg.loadKNm * length * (x - centroid)
    }
  }
  return moment
}

/**
 * Balkenberechnung mit Gleichgewicht und numerischer Integration der Krümmung.
 * Koordinatensystem: x=0 am linken Auflager, x=L am rechten Auflager.
 * Linke Auskragungen liegen bei x<0, rechte Auskragungen bei x>L.
 *
 * Streckenlast wird über ein optionales Array von Segmenten beschrieben.
 * Das Eigengewicht (selfWeightKNm) wirkt über die volle Trägerlänge inkl. Auskragungen.
 */
export function calculateBeam(
  trussType: TrussType,
  spanM: number,
  cantileverStartM: number,
  cantileverEndM: number,
  pointLoads: { positionM: number; forceKN: number }[],
  selfWeightKNm: number,
  distributedSegments: DistributedLoadSegment[] = [],
): BeamInternalForces {
  if (spanM <= 0) throw new Error(`Ungültige Stützweite: ${spanM} m`)
  if (cantileverStartM < 0 || cantileverEndM < 0) {
    throw new Error('Auskragungen dürfen nicht negativ sein')
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
  const totalSelfWeight = selfWeightKNm * totalLength
  const centroidOfSelfWeight = -cantileverStartM + totalLength / 2
  sumMomentsAroundA += totalSelfWeight * centroidOfSelfWeight
  sumVerticalLoads += totalSelfWeight

  for (const seg of distributedSegments) {
    const length = seg.endM - seg.startM
    if (length <= 0) continue
    const segForce = seg.loadKNm * length
    const segCentroid = (seg.startM + seg.endM) / 2
    sumMomentsAroundA += segForce * segCentroid
    sumVerticalLoads += segForce
  }

  const reactionEnd = sumMomentsAroundA / span
  const reactionStart = sumVerticalLoads - reactionEnd

  const numSamples = 1000
  const xStart = -cantileverStartM
  const xEnd = span + cantileverEndM
  const dx = (xEnd - xStart) / numSamples

  let maxMoment = 0
  let posOfMaxMoment = 0
  let maxShear = 0
  const forceSamples: ForceSample[] = []

  for (let index = 0; index <= numSamples; index += 1) {
    const x = xStart + index * dx

    let shearKN = -selfWeightKNm * (x - xStart)
    shearKN += distributedShearAtX(distributedSegments, x)
    if (x >= 0) shearKN += reactionStart
    if (x > span) shearKN -= reactionEnd
    for (const load of pointLoads) {
      if (x >= load.positionM) shearKN -= load.forceKN
    }

    let momentKNm = -selfWeightKNm * (x - xStart) ** 2 / 2
    momentKNm += distributedMomentAtX(distributedSegments, x)
    if (x >= 0) momentKNm += reactionStart * x
    if (x >= span) momentKNm -= reactionEnd * (x - span)
    for (const load of pointLoads) {
      if (x >= load.positionM) momentKNm -= load.forceKN * (x - load.positionM)
    }

    forceSamples.push({ x, momentKNm, shearKN })

    if (Math.abs(momentKNm) > Math.abs(maxMoment)) {
      maxMoment = momentKNm
      posOfMaxMoment = x
    }
    if (Math.abs(shearKN) > Math.abs(maxShear)) {
      maxShear = shearKN
    }
  }

  const eiKNm2 = props.eModulus * props.momentOfInertiaY * 1e-4
  const deflectionResult = calculateDeflectionResult(forceSamples, span, eiKNm2)

  return {
    maxBendingMomentKNm: Math.abs(maxMoment),
    positionOfMaxMomentM: posOfMaxMoment,
    reactionStartKN: reactionStart,
    reactionEndKN: reactionEnd,
    maxShearForceKN: Math.abs(maxShear),
    maxDeflectionMm: deflectionResult.maxDeflectionMm,
    samples: downsampleForceSamples(deflectionResult.samples),
  }
}
