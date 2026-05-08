import type { Support, TippingDirectionResult, TippingResult } from '../types'
import { getFootProperties } from '../materials/database'

const G = 9.81

/** Kompasswinkel (0°=N) → mathematischer Winkel (0°=+X) für interne Berechnung */
function compassToMathAngle(compassDeg: number): number {
  return (90 - compassDeg + 360) % 360
}

/**
 * Wirksamer Kipparm des Fußsystems in Metern, projiziert auf die Windrichtung.
 * Für BASEPLATE mit outriggerLength: überschreibt den Datenbankwert.
 * windMathAngleDeg ist der MATHEMATISCHE Winkel (0°=+X).
 */
function getEffectiveTippingArmM(support: Support, windMathAngleDeg: number): number {
  const footProps = getFootProperties(support.footType)
  let armXm: number
  let armYm: number

  if (support.footType === 'BASEPLATE' && support.outriggerLength !== undefined && support.outriggerLength > 0) {
    armXm = support.outriggerLength
    armYm = support.outriggerLength
  } else {
    armXm = footProps.tippingArmX / 1000
    armYm = footProps.tippingArmY / 1000
  }

  const rad = (windMathAngleDeg * Math.PI) / 180
  return Math.abs(armXm * Math.cos(rad) + armYm * Math.sin(rad))
}

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
 * Die Kippachse liegt an der windseitigen Außenkante des Fußsystems (tippingArm aus
 * FOOT_DATABASE). Alle Stützen – auch die windseitigen – leisten dadurch einen
 * stabilisierenden Beitrag. windDirectionAngleDeg ist der MATHEMATISCHE Winkel (0°=+X).
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

  // Wirksamer Kipparm der windseitigen Stützen (konservativ: Minimum)
  const windwardTippingArmM = Math.min(
    ...tippingAxisIds.map(id => {
      const support = supports.find(s => s.id === id)!
      return getEffectiveTippingArmM(support, windDirectionAngleDeg)
    }),
  )

  // Alle Stützen erhalten einen Hebelarm = Basisabstand zur Achse + windwardTippingArmM.
  // Windseitige Stützen liegen auf der Achse (Basisabstand = 0) und bekommen den Kipparm.
  // Leeseitige Stützen bekommen ihren Abstand + Kipparm als vergrößerten Hebelarm.
  const allStabilizing = supports
    .map(support => {
      const isWindward = tippingAxisIds.includes(support.id)
      const baseDistance = isWindward
        ? 0
        : signedDistanceToAxis(support, axisOrigin, normalVec)
      return { support, leverArmM: baseDistance + windwardTippingArmM, isWindward }
    })
    .filter(e => e.leverArmM > 0)

  const leewardSupports = allStabilizing.filter(e => !e.isWindward)

  const tippingMomentKNm = Math.max(0, totalWindForceKN * windApplicationHeightM)
  const stabilizingMomentKNm = allStabilizing.reduce((sum, entry) => {
    const verticalReactionKN = Math.max(0, supportVerticalReactions.get(entry.support.id) ?? 0)
    return sum + verticalReactionKN * entry.leverArmM
  }, 0)

  // Maßgebender Hebelarm für Ballastberechnung: Leeseitige Stützen (oder Kipparm falls keine)
  const maxLeverArmM = leewardSupports.length > 0
    ? leewardSupports.reduce((max, e) => Math.max(max, e.leverArmM), 0)
    : windwardTippingArmM

  const momentDeficitKNm = Math.max(0, tippingMomentKNm - stabilizingMomentKNm)
  const requiredBallastTotalKg = maxLeverArmM > 0
    ? (momentDeficitKNm * 1000) / (G * maxLeverArmM)
    : (momentDeficitKNm * 1000) / G

  // Ballast wird auf leeseitigen Stützen angesetzt; bei 2-Stützen-System auf beide Achsstützen
  const ballastSupportIds = leewardSupports.length > 0
    ? leewardSupports.map(e => e.support.id)
    : [...tippingAxisIds]
  const requiredBallastPerSupportKg = requiredBallastTotalKg / ballastSupportIds.length

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

/**
 * Berechnet alle Windrichtungen und gibt den massgebenden Lastfall zurueck.
 *
 * windMode 'AUTO': alle 4 Hauptrichtungen (0°/N, 90°/O, 180°/S, 270°/W).
 * windMode 'MANUAL': nur die in manualWindDirections angegebenen Kompasswinkel.
 * Leeres manualWindDirections fällt auf AUTO zurück.
 *
 * getWindForceKN: Funktion die für einen Kompasswinkel die Windkraft in kN liefert.
 * Ermöglicht richtungsabhängige Windkräfte je Fläche.
 */
export function calculateTippingAllDirections(
  supports: Support[],
  getWindForceKN: (compassAngleDeg: number) => number,
  windApplicationHeightM: number,
  supportVerticalReactions: Map<string, number>,
  windMode: 'AUTO' | 'MANUAL' = 'AUTO',
  manualWindDirections?: number[],
): TippingResult {
  const compassAngles =
    windMode === 'MANUAL' && manualWindDirections && manualWindDirections.length > 0
      ? manualWindDirections
      : [0, 90, 180, 270]

  const directions = compassAngles.map(compassAngle => ({
    angleDeg: compassAngle,
    result: calculateTipping(
      supports,
      getWindForceKN(compassAngle),
      compassToMathAngle(compassAngle),
      windApplicationHeightM,
      supportVerticalReactions,
    ),
  }))

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
    directions,
    governing: governing.result,
    governingAngleDeg: governing.angleDeg,
  }
}
