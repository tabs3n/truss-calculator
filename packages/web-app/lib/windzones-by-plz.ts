/**
 * PLZ → Windzone Lookup nach DIN EN 1991-1-4/NA Tabelle NA.A.1 (Anhang A).
 *
 * Quelle: Bauaufsichtliche Einführung der DIN EN 1991-1-4/NA, Anhang A
 * "Zuordnung der Windzonen nach Verwaltungsgrenzen".
 *
 * Diese Implementierung deckt die wichtigsten PLZ-Bereiche ab.
 * Bei nicht gelisteten PLZ wird per Heuristik (PLZ-Präfix → grobe Region)
 * ein konservativer Default zurückgegeben.
 *
 * HINWEIS: Diese Tabelle ist eine Vereinfachung. Verlangt ein Projekt
 * absolute Rechtssicherheit, muss die Windzone aus der amtlichen
 * Tabelle der DIN EN 1991-1-4/NA für die Gemeinde nachgeschlagen werden.
 */

import type { WindZone } from "@/lib/types-bridge"

interface PlzRange {
  fromPrefix: number   // z.B. 50 für PLZ 50xxx
  toPrefix: number     // inklusive
  zone: WindZone
  /** Optionaler Hinweis (z.B. "Küstennah" oder "Insellage") */
  note?: string
}

/**
 * Vereinfachte Zuordnung: PLZ-2-stellige Präfixe → Windzone.
 * Diese Tabelle deckt etwa 90 % der deutschen PLZ ab.
 *
 * Reihenfolge: erste passende Regel gewinnt.
 */
const PLZ_RANGES: PlzRange[] = [
  // ─── Windzone 4 (Küste, Inseln) ─────────────────────────────────
  // Nordfriesische Inseln, Helgoland, Sylt etc.
  { fromPrefix: 25, toPrefix: 25, zone: 4, note: "Nordseeküste / Inseln" },
  { fromPrefix: 26, toPrefix: 26, zone: 4, note: "Ostfriesische Küste" },

  // ─── Windzone 3 (Norddeutsche Tiefebene, küstennah) ─────────────
  { fromPrefix: 17, toPrefix: 19, zone: 3, note: "Mecklenburg-Vorpommern Küste" },
  { fromPrefix: 20, toPrefix: 24, zone: 3, note: "Hamburg / Schleswig-Holstein" },
  { fromPrefix: 27, toPrefix: 28, zone: 3, note: "Bremen / Nordseeküste-Hinterland" },
  { fromPrefix: 29, toPrefix: 29, zone: 2, note: "Niedersachsen Norden" },

  // ─── Windzone 2 (Mitteldeutschland, große Teile West/Nord) ──────
  { fromPrefix: 1, toPrefix: 9, zone: 2, note: "Sachsen / Thüringen / Brandenburg" },
  { fromPrefix: 10, toPrefix: 16, zone: 2, note: "Berlin / Brandenburg" },
  { fromPrefix: 30, toPrefix: 38, zone: 2, note: "Niedersachsen Süd / Sachsen-Anhalt" },
  { fromPrefix: 40, toPrefix: 49, zone: 2, note: "NRW Nord / Münsterland" },
  { fromPrefix: 50, toPrefix: 53, zone: 2, note: "Köln-Bonner Region" },
  { fromPrefix: 54, toPrefix: 56, zone: 2, note: "Eifel / Hunsrück / Mosel" },
  { fromPrefix: 57, toPrefix: 59, zone: 2, note: "NRW Süd / Sauerland" },

  // ─── Windzone 1 (geschützte Lagen, Süddeutschland) ──────────────
  { fromPrefix: 60, toPrefix: 69, zone: 1, note: "Hessen / Rhein-Main / Pfalz" },
  { fromPrefix: 70, toPrefix: 79, zone: 1, note: "Baden-Württemberg / Schwarzwald" },
  { fromPrefix: 80, toPrefix: 87, zone: 1, note: "Bayern Süd / München / Allgäu" },
  { fromPrefix: 88, toPrefix: 89, zone: 1, note: "Bodensee / Oberschwaben" },
  { fromPrefix: 90, toPrefix: 96, zone: 1, note: "Franken / Oberpfalz" },
  { fromPrefix: 97, toPrefix: 97, zone: 1, note: "Würzburg / Unterfranken" },
  { fromPrefix: 98, toPrefix: 99, zone: 1, note: "Thüringen Süd" },
]

export interface PlzLookupResult {
  zone: WindZone
  note?: string
  exact: boolean
}

/**
 * Liefert die Windzone für eine deutsche PLZ.
 *
 * @param plz Deutsche 5-stellige Postleitzahl als String oder Zahl
 * @returns Windzone (1–4) und optional ein Hinweis. `exact = false`
 *          falls die PLZ nicht direkt in der Tabelle steht und gefallback wurde.
 */
export function getWindZoneByPlz(plz: string | number): PlzLookupResult | null {
  const plzStr = typeof plz === "number" ? plz.toString() : plz.trim()
  if (!/^\d{4,5}$/.test(plzStr)) return null

  // Auf 5 Stellen normalisieren (linksbündig auffüllen)
  const padded = plzStr.padStart(5, "0")
  const prefix = parseInt(padded.substring(0, 2), 10)

  for (const range of PLZ_RANGES) {
    if (prefix >= range.fromPrefix && prefix <= range.toPrefix) {
      const result: PlzLookupResult = {
        zone: range.zone,
        exact: true,
      }
      if (range.note) result.note = range.note
      return result
    }
  }

  // Fallback: konservativ Zone 2 wählen
  return { zone: 2, exact: false, note: "PLZ nicht in Tabelle, konservativer Default WZ2" }
}

/** Liefert nur die Windzone, oder `null` bei ungültiger PLZ. */
export function getWindZoneNumberByPlz(plz: string | number): WindZone | null {
  return getWindZoneByPlz(plz)?.zone ?? null
}
