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

/**
 * Analytische Balkenberechnung mit Superposition.
 * Koordinatensystem: x=0 am linken Auflager, x=L am rechten Auflager.
 * Auskragungen liegen bei x<0 (links) und x>L (rechts).
 *
 * Alle Einzellasten werden in Auflager-Koordinaten übergeben
 * (positionM = 0 entspricht linkem Auflager).
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

  const L = spanM
  const props = getTrussProperties(trussType)
  const EI = props.eModulus * props.momentOfInertiaY // kN/cm² × cm⁴ = kN·cm²

  // ── Auflagerkräfte ─────────────────────────────────────────────────────────
  // Summe Momente um linkes Auflager (A) → Reaktion B, dann A aus ΣFv=0

  let sumMomentsAroundA = 0
  let sumVerticalLoads = 0

  // Einzellasten (inkl. Auskragungslasten, die außerhalb [0,L] liegen können)
  for (const load of pointLoads) {
    sumMomentsAroundA += load.forceKN * load.positionM
    sumVerticalLoads += load.forceKN
  }

  // Streckenlast über gesamte Länge inkl. Auskragungen
  const totalLength = cantileverStartM + L + cantileverEndM
  const totalDistributed = distributedLoadKNm * totalLength
  // Schwerpunkt der Streckenlast bezogen auf linkes Auflager A
  const centroidOfDistributed = -cantileverStartM + totalLength / 2
  sumMomentsAroundA += totalDistributed * centroidOfDistributed
  sumVerticalLoads += totalDistributed

  const reactionEnd = sumMomentsAroundA / L       // B
  const reactionStart = sumVerticalLoads - reactionEnd  // A

  // ── Biegemoment-Verlauf ───────────────────────────────────────────────────
  // Abtastung mit 1000 Punkten über Gesamtlänge
  const segments = 1000
  const xStart = -cantileverStartM
  const xEnd = L + cantileverEndM
  const dx = (xEnd - xStart) / segments

  let maxMoment = 0
  let posOfMaxMoment = 0
  let maxShear = 0

  for (let i = 0; i <= segments; i++) {
    const x = xStart + i * dx

    // Querkraft Q(x): Reaktion A wirkt bei x=0, Reaktion B bei x=L
    let Q = -distributedLoadKNm * (x - xStart)
    if (x >= 0) Q += reactionStart
    if (x >= L) Q -= reactionEnd
    for (const load of pointLoads) {
      if (x >= load.positionM) Q -= load.forceKN
    }

    // Biegemoment M(x)
    let M = -distributedLoadKNm * (x - xStart) * (x - xStart) / 2
    if (x >= 0) M += reactionStart * x
    if (x >= L) M -= reactionEnd * (x - L)
    for (const load of pointLoads) {
      if (x >= load.positionM) M -= load.forceKN * (x - load.positionM)
    }

    if (Math.abs(M) > Math.abs(maxMoment)) {
      maxMoment = M
      posOfMaxMoment = x
    }
    if (Math.abs(Q) > Math.abs(maxShear)) {
      maxShear = Q
    }
  }

  // ── Maximale Durchbiegung (vereinfacht: Einfeldträger mit Strecken- und Einzellasten)
  // Analytische Formel für Einfeldträger; Auskragungsanteile werden konservativ addiert.
  // EI in kN·cm², L in m → Konversion: L_cm = L*100
  const L_cm = L * 100

  // Streckenlast im Feld: w_field = distributedLoadKNm, δ_max = 5wL⁴/(384EI)
  let deflectionCm = (5 * distributedLoadKNm * Math.pow(L_cm, 4)) / (384 * EI)

  // Einzellasten im Feld: δ = Pa(3L²-4a²)/(48EI) für Mittellast, allgemein: Pb(3L²-b²-... )
  // Näherung: Einzellast P bei Position a vom linken Auflager, b = L-a
  for (const load of pointLoads) {
    if (load.positionM >= 0 && load.positionM <= L) {
      const a_cm = load.positionM * 100
      const b_cm = L_cm - a_cm
      // maximale Durchbiegung nach Superpositionsprinzip
      const delta = (load.forceKN * a_cm * b_cm * Math.sqrt(3 * a_cm * a_cm + 2 * a_cm * b_cm + 3 * b_cm * b_cm - a_cm * b_cm)) / (27 * EI * L_cm)
      deflectionCm += Math.abs(delta)
    }
  }

  return {
    maxBendingMomentKNm: Math.abs(maxMoment),
    positionOfMaxMomentM: posOfMaxMoment,
    reactionStartKN: reactionStart,
    reactionEndKN: reactionEnd,
    maxShearForceKN: Math.abs(maxShear),
    maxDeflectionMm: deflectionCm * 10,
  }
}
