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

/**
 * Findet die wirklich windseitigen Stützen: alle mit (annähernd) maximaler
 * Projektion auf den Windvektor. Damit wird eine Stütze, die deutlich näher
 * am Lee liegt, nicht fälschlich als "auf der Kippachse" behandelt.
 */
function findWindwardSupports(supports: Support[], windAngleDeg: number): string[] {
  if (supports.length < 1) {
    throw new Error('Mindestens 1 Stütze erforderlich für Kippsicherheitsnachweis')
  }
  const rad = (windAngleDeg * Math.PI) / 180
  const wx = Math.cos(rad)
  const wy = Math.sin(rad)

  const projections = supports.map(s => ({
    id: s.id,
    proj: s.position.x * wx + s.position.y * wy,
  }))
  const maxProj = Math.max(...projections.map(p => p.proj))
  // Toleranz skaliert mit der Strukturgröße, damit gleiche Projektionen
  // auch bei großen Koordinaten als gleich erkannt werden.
  const scale = Math.max(1, Math.abs(maxProj))
  const tol = 1e-9 * scale
  return projections.filter(p => Math.abs(p.proj - maxProj) <= tol).map(p => p.id)
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

/**
 * Lee-Richtung: entgegen der Windrichtung. Funktioniert für 1 oder mehrere
 * windseitige Stützen, da der Normalenvektor direkt aus dem Windwinkel kommt
 * und nicht von einer Achse durch zwei Stützen abhängt.
 */
function buildLeewardNormal(windAngleDeg: number) {
  const rad = (windAngleDeg * Math.PI) / 180
  return { x: -Math.cos(rad), y: -Math.sin(rad) }
}

/**
 * Kippsicherheitsnachweis für eine Windrichtung.
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
    throw new Error('Mindestens 2 Stützen erforderlich')
  }

  // Wirklich windseitige Stützen (alle mit max. Projektion)
  const windwardIds = findWindwardSupports(supports, windDirectionAngleDeg)
  const windwardSet = new Set(windwardIds)
  const axisOrigin = supports.find(s => s.id === windwardIds[0])!
  const normalVec = buildLeewardNormal(windDirectionAngleDeg)

  // Wirksamer Kipparm der windseitigen Stützen (konservativ: Minimum)
  const windwardTippingArmM = Math.min(
    ...windwardIds.map(id => {
      const support = supports.find(s => s.id === id)!
      return getEffectiveTippingArmM(support, windDirectionAngleDeg)
    }),
  )

  // Alle Stützen: Hebelarm = signedDistanceToLeeward + windwardTippingArmM
  // - Windseitige Stützen: signedDistance = 0 → Hebelarm = windwardTippingArmM
  // - Leeseitige Stützen: signedDistance > 0 → Hebelarm = Abstand + Kipparm
  // - Stützen vor der windseitigen Außenkante (selten, asymmetrisch): leverArm < 0 → ignoriert
  const allStabilizing = supports
    .map(support => {
      const isWindward = windwardSet.has(support.id)
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

  // Ballast-Träger: Leeseitige Stützen, sonst (echte 2-Stützen-Anordnung mit allem auf der Achse)
  // beide Achsstützen.
  const ballastEntries = leewardSupports.length > 0 ? leewardSupports : allStabilizing
  const ballastSupportIds = ballastEntries.map(e => e.support.id)
  // Für gleichmäßig verteilten Ballast ist der wirksame Hebelarm der MITTELWERT
  // der Hebelarme der Ballaststützen (nicht das Maximum). Dadurch wird auch bei
  // asymmetrischen Anordnungen das Momentengleichgewicht exakt eingehalten.
  const meanBallastLeverArmM = ballastEntries.length > 0
    ? ballastEntries.reduce((sum, e) => sum + e.leverArmM, 0) / ballastEntries.length
    : windwardTippingArmM

  const momentDeficitKNm = Math.max(0, tippingMomentKNm - stabilizingMomentKNm)
  const requiredBallastTotalKg = meanBallastLeverArmM > 0
    ? (momentDeficitKNm * 1000) / (G * meanBallastLeverArmM)
    : (momentDeficitKNm * 1000) / G

  const requiredBallastPerSupportKg = ballastSupportIds.length > 0
    ? requiredBallastTotalKg / ballastSupportIds.length
    : requiredBallastTotalKg

  // Geschätzte Aufhebkraft an der Kippachse: Gesamtdefizit / Kipparm
  // (Defizit wird über die Achse aufgenommen, durch beide Achsstützen geteilt)
  const upliftFromWindKN = windwardTippingArmM > 0
    ? momentDeficitKNm / windwardTippingArmM
    : tippingMomentKNm
  const reactionsOnAxis = windwardIds.map(id => supportVerticalReactions.get(id) ?? 0)
  const minVerticalReaction = Math.min(...reactionsOnAxis) - upliftFromWindKN / windwardIds.length
  const utilization = tippingMomentKNm === 0
    ? 0
    : stabilizingMomentKNm > 0
      ? tippingMomentKNm / stabilizingMomentKNm
      : Infinity

  // tippingAxisSupportIds: 1-2 windseitige Stützen
  const tippingAxisSupportIds: string[] = [...windwardIds]

  // Summe der EQU-Vertikalreaktionen aller stabilisierenden Stützen
  const totalEquVerticalReactionKN = allStabilizing.reduce((sum, entry) => {
    return sum + Math.max(0, supportVerticalReactions.get(entry.support.id) ?? 0)
  }, 0)
  // Wirksamer (gewichteter) Hebelarm = Ms / Rz_total
  const effectiveLeverArmM = totalEquVerticalReactionKN > 0
    ? stabilizingMomentKNm / totalEquVerticalReactionKN
    : windwardTippingArmM

  return {
    minVerticalReactionKN: minVerticalReaction,
    tippingAxisSupportIds,
    ballastSupportIds,
    requiredBallastPerSupportKg,
    requiredBallastTotalKg,
    utilization,
    isOk: minVerticalReaction >= 0 && utilization <= 1,
    designHorizontalForceKN: totalWindForceKN,
    designTippingMomentKNm: tippingMomentKNm,
    designStabilizingMomentKNm: stabilizingMomentKNm,
    effectiveLeverArmM,
    totalEquVerticalReactionKN,
    applicationHeightM: windApplicationHeightM,
  }
}

/**
 * Berechnet alle Windrichtungen und gibt den maßgebenden Lastfall zurück.
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
