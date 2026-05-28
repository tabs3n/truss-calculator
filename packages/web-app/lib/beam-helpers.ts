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
 * Berechnet die "nach hinten" Richtung eines Outriggers (Einheitsvektor, 2-D).
 *
 * Logik: Der Outrigger liegt senkrecht zur Traverse (Spannrichtung).
 * Von den zwei möglichen Senkrechten wählen wir die mit negativerer Y-Komponente
 * (bzw. negativerer X-Komponente wenn Y gleich) – das entspricht der Konvention
 * "nach hinten, weg vom Publikum" in der VectorWorks-Grundrissdarstellung.
 * Fallback: (0, -1), d.h. rein nach Süden.
 */
export function getOutriggerBackwardDir(
  support: Support,
  beams: Beam[],
  allSupports: Support[],
): { x: number; y: number } {
  // Alle Stützen sammeln, die über eine Traverse mit dieser verbunden sind
  const connected: { x: number; y: number }[] = []
  for (const beam of beams) {
    const beamSupports = getOrderedBeamSupports(beam, allSupports)
    if (!beamSupports.some((s) => s.id === support.id)) continue
    for (const s of beamSupports) {
      if (s.id !== support.id) connected.push(s.position)
    }
  }

  if (connected.length === 0) return { x: 0, y: -1 }

  // Mittlere Richtung zu den verbundenen Stützen = Traversenrichtung
  let dx = 0, dy = 0
  for (const p of connected) {
    dx += p.x - support.position.x
    dy += p.y - support.position.y
  }
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return { x: 0, y: -1 }

  const nx = dx / len, ny = dy / len
  // Zwei senkrechte Richtungen zur Traverse
  const p1 = { x: -ny, y: nx }
  const p2 = { x: ny, y: -nx }
  // Wähle die "hintere" Richtung (negativeres Y; bei Gleichstand negativeres X)
  return p1.y < p2.y || (p1.y === p2.y && p1.x < p2.x) ? p1 : p2
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
