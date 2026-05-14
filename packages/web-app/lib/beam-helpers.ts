import type { Beam, Support } from "@/lib/types-bridge"

/**
 * Liefert die Stützen einer Traverse in der physikalisch korrekten Reihenfolge:
 *  - Erste = supportIds[0] (Start)
 *  - Letzte = supportIds[last] (Ende)
 *  - Zwischenstützen sortiert nach Projektion auf den Start→Ende-Vektor
 *
 * Das stellt sicher, dass der Polylinien-Zug monoton ist und Beam-Längen
 * sowie Lastpositionen physikalisch sinnvoll sind, unabhängig von der
 * Reihenfolge in der der Nutzer die Zwischenstützen ausgewählt hat.
 */
export function getOrderedBeamSupports(beam: Beam, supports: Support[]): Support[] {
  const ids = beam.supportIds && beam.supportIds.length >= 2
    ? beam.supportIds
    : [beam.startSupportId, beam.endSupportId]

  const list = ids
    .map((id) => supports.find((s) => s.id === id))
    .filter((s): s is Support => Boolean(s))

  if (list.length < 3) return list  // <3 → keine Sortierung nötig

  const first = list[0]!
  const last = list[list.length - 1]!
  const vx = last.position.x - first.position.x
  const vy = last.position.y - first.position.y
  const len2 = vx * vx + vy * vy
  if (len2 === 0) return list  // Start und Ende auf gleicher Position

  // Sortiere Zwischenstützen nach Projektionsparameter t ∈ [0, 1]
  const intermediates = list.slice(1, -1).map((s) => {
    const dx = s.position.x - first.position.x
    const dy = s.position.y - first.position.y
    const t = (dx * vx + dy * vy) / len2
    return { support: s, t }
  })
  intermediates.sort((a, b) => a.t - b.t)

  return [first, ...intermediates.map((e) => e.support), last]
}

/**
 * Liefert die IDs in physikalisch korrekter Reihenfolge.
 * Praktisch für die Speicherung im Beam.supportIds.
 */
export function getOrderedBeamSupportIds(beam: Beam, supports: Support[]): string[] {
  return getOrderedBeamSupports(beam, supports).map((s) => s.id)
}

/**
 * Berechnet die Gesamtspannweite (Summe aller Segmente) entlang der
 * korrekt sortierten Polylinie. KEIN Cantilever.
 */
export function getBeamPolylineLengthM(beam: Beam, supports: Support[]): number {
  const ordered = getOrderedBeamSupports(beam, supports)
  let total = 0
  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i]!
    const b = ordered[i + 1]!
    total += Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y)
  }
  return total
}
