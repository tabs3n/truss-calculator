import type { Support, TippingDirectionResult } from '../types'

const G = 9.81

type DirectionKey = 'windPlusX' | 'windPlusY' | 'windMinusX' | 'windMinusY'

function findTippingAxis(
  supports: Support[],
  windAngleDeg: number,
): [string, string] {
  const rad = (windAngleDeg * Math.PI) / 180
  const windVector = { x: Math.cos(rad), y: Math.sin(rad) }

  const projections = supports.map(support => ({
    id: support.id,
    proj: support.position.x * windVector.x + support.position.y * windVector.y,
  }))
  projections.sort((a, b) => b.proj - a.proj)

  const first = projections[0]
  const second = projections[1]
  if (!first || !second) {
    throw new Error('Mindestens 2 Stuetzen erforderlich fuer Kippsicherheitsnachweis')
  }

  return [first.id, second.id]
}

function signedDistanceToAxis(
  support: Support,
  axisOrigin: Support,
  normalVec: { x: number; y: number },
) {
  const dx = support.position.x - axisOrigin.position.x
  const dy = support.position.y - axisOrigin.position.y

  return dx * normalVec.x + dy * normalVec.y
}

function buildLeewardNormal(
  axisSupports: [Support, Support],
  windAngleDeg: number,
) {
  const axisVec = {
    x: axisSupports[1].position.x - axisSupports[0].position.x,
    y: axisSupports[1].position.y - axisSupports[0].position.y,
  }
  const axisLen = Math.hypot(axisVec.x, axisVec.y)
  const baseNormal = axisLen > 0
    ? { x: axisVec.y / axisLen, y: -axisVec.x / axisLen }
    : { x: 1, y: 0 }

  const rad = (windAngleDeg * Math.PI) / 180
  const windVector = { x: Math.cos(rad), y: Math.sin(rad) }

  // Stabilisierender Ballast liegt auf der Leeseite, also entgegen der Windrichtung.
  const pointsLeeward = baseNormal.x * windVector.x + baseNormal.y * windVector.y <= 0
  return pointsLeeward ? baseNormal : { x: -baseNormal.x, y: -baseNormal.y }
}

/**
 * Kippsicherheitsnachweis fuer eine Windrichtung.
 *
 * Der erforderliche Zusatzballast wird aus dem Momentendefizit gegenueber dem
 * stabilisierenden Moment berechnet. Ballast direkt auf der Kippachse hat
 * keinen wirksamen Hebelarm und darf daher nicht stabilisierend angesetzt werden.
 */
export function calculateTipping(
  supports: Support[],
  totalWindForceKN: number,
  windDirectionAngleDeg: number,
  windApplicationHeightM: number,
  supportVerticalReactions: Map<string, number>,
): TippingDirectionResult {
  if (supports.length < 2) {
    throw new Error('Mindestens 2 Stuetzen erforderlich')
  }

  const tippingAxisIds = findTippingAxis(supports, windDirectionAngleDeg)
  const axisSupports = tippingAxisIds.map(id => {
    const support = supports.find(candidate => candidate.id === id)
    if (!support) throw new Error(`Stuetze ${id} nicht gefunden`)
    return support
  }) as [Support, Support]

  const normalVec = buildLeewardNormal(axisSupports, windDirectionAngleDeg)
  const axisOrigin = axisSupports[0]
  const offAxisSupports = supports.filter(support => !tippingAxisIds.includes(support.id))
  const leewardSupports = offAxisSupports
    .map(support => ({
      support,
      leverArmM: signedDistanceToAxis(support, axisOrigin, normalVec),
    }))
    .filter(entry => entry.leverArmM > 0)

  const tippingMomentKNm = Math.max(0, totalWindForceKN * windApplicationHeightM)
  const stabilizingMomentKNm = leewardSupports.reduce((sum, entry) => {
    const verticalReactionKN = Math.max(0, supportVerticalReactions.get(entry.support.id) ?? 0)
    return sum + verticalReactionKN * entry.leverArmM
  }, 0)

  const maxLeverArmM = leewardSupports.reduce(
    (max, entry) => Math.max(max, entry.leverArmM),
    0,
  )
  const momentDeficitKNm = Math.max(0, tippingMomentKNm - stabilizingMomentKNm)

  const requiredBallastTotalKg = maxLeverArmM > 0
    ? (momentDeficitKNm * 1000) / (G * maxLeverArmM)
    : (momentDeficitKNm * 1000) / G
  const ballastSupportIds = leewardSupports.map(entry => entry.support.id)
  const ballastSupportCount = ballastSupportIds.length > 0 ? ballastSupportIds.length : tippingAxisIds.length
  const requiredBallastPerSupportKg = requiredBallastTotalKg / ballastSupportCount

  const upliftFromWindKN = maxLeverArmM > 0
    ? momentDeficitKNm / maxLeverArmM
    : tippingMomentKNm
  const reactionsOnAxis = tippingAxisIds.map(id => supportVerticalReactions.get(id) ?? 0)
  const minVerticalReaction = Math.min(...reactionsOnAxis) - upliftFromWindKN / tippingAxisIds.length
  const utilization = tippingMomentKNm === 0
    ? 0
    : stabilizingMomentKNm > 0
      ? tippingMomentKNm / stabilizingMomentKNm
      : Infinity

  return {
    minVerticalReactionKN: minVerticalReaction,
    tippingAxisSupportIds: tippingAxisIds,
    ballastSupportIds,
    requiredBallastPerSupportKg,
    requiredBallastTotalKg,
    utilization,
    isOk: minVerticalReaction >= 0 && utilization <= 1,
  }
}

/** Berechnet alle 4 Windrichtungen und gibt den massgebenden Lastfall zurueck. */
export function calculateTippingAllDirections(
  supports: Support[],
  totalWindForceKN: number,
  windApplicationHeightM: number,
  supportVerticalReactions: Map<string, number>,
): {
  windPlusX: TippingDirectionResult
  windPlusY: TippingDirectionResult
  windMinusX: TippingDirectionResult
  windMinusY: TippingDirectionResult
  governing: TippingDirectionResult
  governingDirection: DirectionKey
} {
  const windPlusX = calculateTipping(supports, totalWindForceKN, 0, windApplicationHeightM, supportVerticalReactions)
  const windPlusY = calculateTipping(supports, totalWindForceKN, 90, windApplicationHeightM, supportVerticalReactions)
  const windMinusX = calculateTipping(supports, totalWindForceKN, 180, windApplicationHeightM, supportVerticalReactions)
  const windMinusY = calculateTipping(supports, totalWindForceKN, 270, windApplicationHeightM, supportVerticalReactions)

  const directions = [
    { key: 'windPlusX' as const, result: windPlusX },
    { key: 'windPlusY' as const, result: windPlusY },
    { key: 'windMinusX' as const, result: windMinusX },
    { key: 'windMinusY' as const, result: windMinusY },
  ]

  const governing = directions.reduce((prev, curr) => {
    if (curr.result.requiredBallastTotalKg > prev.result.requiredBallastTotalKg) return curr
    if (
      curr.result.requiredBallastTotalKg === prev.result.requiredBallastTotalKg &&
      curr.result.utilization > prev.result.utilization
    ) {
      return curr
    }
    return prev
  })

  return {
    windPlusX,
    windPlusY,
    windMinusX,
    windMinusY,
    governing: governing.result,
    governingDirection: governing.key,
  }
}
