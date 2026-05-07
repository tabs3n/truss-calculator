import type { Support, TippingDirectionResult } from '../types.js'

const G = 9.81 // m/s²

/**
 * Projiziert alle Stützenpositionen auf die Windrichtung und bestimmt
 * die zwei "vordersten" (windseitigen) Stützen als Kippachse.
 *
 * windAngleDeg: 0° = Wind in +X, 90° = Wind in +Y, 180° = Wind in -X, 270° = Wind in -Y
 */
function findTippingAxis(
  supports: Support[],
  windAngleDeg: number,
): [string, string] {
  const rad = (windAngleDeg * Math.PI) / 180
  // Windrichtungsvektor (Anströmrichtung)
  const wx = Math.cos(rad)
  const wy = Math.sin(rad)

  // Projektion jeder Stütze auf Windrichtung; größte Projektion = windseitig vorne
  const projections = supports.map(s => ({
    id: s.id,
    proj: s.position.x * wx + s.position.y * wy,
  }))
  projections.sort((a, b) => b.proj - a.proj) // absteigend

  const first = projections[0]
  const second = projections[1]
  if (!first || !second) {
    throw new Error('Mindestens 2 Stützen erforderlich für Kippsicherheitsnachweis')
  }
  return [first.id, second.id]
}

/**
 * Kippsicherheitsnachweis für eine Windrichtung.
 *
 * Kippmoment: Fw × Angriffshöhe (um Kippachse)
 * Stabilisierendes Moment: Summe (Rz,i × Abstand zur Kippachse)
 * Rz,min: kleinste (negativste) Auflagerkraft nach Gleichgewicht
 */
export function calculateTipping(
  supports: Support[],
  totalWindForceKN: number,
  windDirectionAngleDeg: number,
  windApplicationHeightM: number,
  supportVerticalReactions: Map<string, number>,
): TippingDirectionResult {
  if (supports.length < 2) {
    throw new Error('Mindestens 2 Stützen erforderlich')
  }

  const tippingAxisIds = findTippingAxis(supports, windDirectionAngleDeg)

  // Stützen der Kippachse
  const axisSupports = tippingAxisIds.map(id => {
    const s = supports.find(sup => sup.id === id)
    if (!s) throw new Error(`Stütze ${id} nicht gefunden`)
    return s
  })

  // Kippachsenlinie: Vektor zwischen den zwei Kippachsen-Stützen
  const s0 = axisSupports[0]!
  const s1 = axisSupports[1]!
  const axisVec = { x: s1.position.x - s0.position.x, y: s1.position.y - s0.position.y }
  const axisLen = Math.sqrt(axisVec.x ** 2 + axisVec.y ** 2)

  // Normalvektor zur Kippachse (windwärts zeigend)
  const normalVec = axisLen > 0
    ? { x: axisVec.y / axisLen, y: -axisVec.x / axisLen }
    : { x: 1, y: 0 }

  // Abstände der leeward Stützen zur Kippachse (Hebelarm für stabilisierendes Moment)
  const leewardSupports = supports.filter(s => !tippingAxisIds.includes(s.id))

  // Kippmoment [kN·m] = Fw × Angriffshöhe
  const tippingMoment = totalWindForceKN * windApplicationHeightM

  // Stabilisierendes Moment = Summe (Rz,i × Abstand zur Kippachse)
  let stabilizingMoment = 0
  for (const support of leewardSupports) {
    const Rz = supportVerticalReactions.get(support.id) ?? 0
    // Abstand zur Kippachse: senkrechter Abstand vom Punkt zur Linie durch s0, s1
    const dx = support.position.x - s0.position.x
    const dy = support.position.y - s0.position.y
    const dist = Math.abs(dx * normalVec.x + dy * normalVec.y)
    stabilizingMoment += Math.abs(Rz) * dist
  }

  // Minimale Auflagerkraft (ungünstigste Stütze der Kippachse)
  const reactionsOnAxis = tippingAxisIds.map(id => supportVerticalReactions.get(id) ?? 0)
  const minVerticalReaction = Math.min(...reactionsOnAxis)

  // Erforderlicher Ballast: |Rz,min| × 2 / g [kg]
  const requiredBallastPerSupportKg = minVerticalReaction < 0
    ? Math.abs(minVerticalReaction) * 1000 / G  // kN→N, dann ÷g
    : 0
  const requiredBallastTotalKg = requiredBallastPerSupportKg * 2

  // Ausnutzung: kippendes Moment / stabilisierendes Moment (inkl. vorhandenem Ballast)
  const existingBallastForce = tippingAxisIds.reduce((sum, id) => {
    const support = supports.find(s => s.id === id)
    return sum + (support ? (support.existingBallast * G) / 1000 : 0)
  }, 0)

  const totalStabilizing = stabilizingMoment + existingBallastForce * (axisLen / 2 || 1)
  const utilization = totalStabilizing > 0 ? tippingMoment / totalStabilizing : Infinity

  return {
    minVerticalReactionKN: minVerticalReaction,
    tippingAxisSupportIds: tippingAxisIds,
    requiredBallastPerSupportKg,
    requiredBallastTotalKg,
    utilization,
    isOk: minVerticalReaction >= 0 && utilization <= 1.0,
  }
}

/** Berechnet alle 4 Windrichtungen und gibt maßgebenden Lastfall zurück */
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
  governingDirection: 'windPlusX' | 'windPlusY' | 'windMinusX' | 'windMinusY'
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

  // Maßgebend: größter erforderlicher Ballast
  const governing = directions.reduce((prev, curr) =>
    curr.result.requiredBallastTotalKg > prev.result.requiredBallastTotalKg ? curr : prev,
  )

  return {
    windPlusX,
    windPlusY,
    windMinusX,
    windMinusY,
    governing: governing.result,
    governingDirection: governing.key,
  }
}
