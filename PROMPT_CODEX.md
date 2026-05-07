# Startprompt – Codex / Cursor (web-app)

## Kontext

Du baust den Frontend-Teil eines Standsicherheits-Berechnungstools für Traversensysteme
im Veranstaltungsbereich. Die gesamte Rechenlogik liegt in einem separaten Package
`packages/calc-engine/` – du importierst daraus **nur** die Funktion `calculate()` und
die TypeScript-Types aus `packages/calc-engine/src/types.ts`.

**Du schreibst keine Rechenlogik. Du rufst `calculate(input)` auf und zeigst das Ergebnis.**

---

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript** (strict)
- **Tailwind CSS**
- **Shadcn/ui** für Basiskomponenten
- **react-pdf** für PDF-Export
- **SVG** (inline, kein Canvas) für das 2D-Rendering
- Deploy-Ziel: **Vercel**

---

## Schritt 1: Projekt-Setup

```bash
cd packages/
npx create-next-app@latest web-app --typescript --tailwind --app --no-src-dir
cd web-app
npx shadcn-ui@latest init
```

Installiere zusätzlich:
```bash
npm install @react-pdf/renderer
```

Symlink oder workspace-Referenz zu `calc-engine` einrichten (npm workspaces).

---

## Schritt 2: Projektstruktur

Erstelle folgende Ordnerstruktur:

```
web-app/
├── app/
│   ├── page.tsx              ← Startseite / Projektübersicht (leer für MVP)
│   ├── calculator/
│   │   └── page.tsx          ← Hauptseite: Input + Ergebnis
│   └── layout.tsx
├── components/
│   ├── input/
│   │   ├── ProjectForm.tsx        ← Projektname, Windzone, Gelände
│   │   ├── SupportList.tsx        ← Stützen verwalten (hinzufügen, editieren)
│   │   ├── SupportForm.tsx        ← Einzelne Stütze: Position, Höhe, Typ, Fuß
│   │   ├── BeamList.tsx           ← Traversen verwalten
│   │   ├── BeamForm.tsx           ← Einzelne Traverse: Typ, Auskragung, Lasten
│   │   ├── LoadForm.tsx           ← Hängelast hinzufügen
│   │   └── WindSurfaceForm.tsx    ← Windangriffsfläche hinzufügen
│   ├── results/
│   │   ├── ResultSummary.tsx      ← Ampel: OK / NICHT OK + Ballast gesamt
│   │   ├── BallastTable.tsx       ← Tabelle: Ballast je Stütze
│   │   ├── BeamResults.tsx        ← Ausnutzungen Traversen
│   │   └── TippingResults.tsx     ← Kippsicherheit je Richtung
│   ├── rendering/
│   │   ├── StructureRenderer.tsx  ← SVG Grundriss (Draufsicht)
│   │   └── ElevationRenderer.tsx  ← SVG Seitenansicht (Elevation)
│   └── report/
│       ├── ReportButton.tsx       ← PDF-Export Button
│       └── ReportDocument.tsx     ← react-pdf Dokument
├── lib/
│   ├── defaultInput.ts            ← Leeres StructureInput als Startzustand
│   ├── importVW.ts                ← VWExportData → StructureInput konvertierung
│   └── constants.ts               ← Firmendaten, Disclaimer-Text
└── hooks/
    └── useCalculation.ts          ← State + calculate() aufrufen
```

---

## Schritt 3: State Management

Kein externes State-Management (kein Redux, kein Zustand). Nur React `useState`.

Erstelle `hooks/useCalculation.ts`:

```typescript
export function useCalculation() {
  const [input, setInput] = useState<StructureInput>(defaultInput)
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runCalculation = useCallback(() => {
    setIsCalculating(true)
    try {
      const res = calculate(input)  // aus calc-engine
      setResult(res)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setIsCalculating(false)
    }
  }, [input])

  return { input, setInput, result, isCalculating, error, runCalculation }
}
```

---

## Schritt 4: Input-Formulare

### Designprinzipien
- Zweispaltiges Layout Desktop, einspaltig Mobile
- Alle Eingabefelder mit deutschen Labels und Einheiten in Klammern: `Höhe (m)`
- Validierung inline (kein Submit nötig – Berechnung läuft bei jeder Änderung nach 500ms Debounce)
- Fehlerzustand: rote Border + Hinweistext unter dem Feld

### Windzone-Auswahl
Dropdown mit visueller Karte Deutschland (einfache SVG-Umriss-Karte mit eingefärbten Zonen).
Zones 1–4 auswählbar.

### Stützen-Liste (`SupportList.tsx`)
- Tabelle mit einer Zeile pro Stütze
- Spalten: Label | X (m) | Y (m) | Höhe (m) | Typ | Fuß | Ballast vorhanden (kg) | ✏️ | 🗑️
- Button "+ Stütze hinzufügen"
- Beim Klick öffnet sich `SupportForm` als Drawer (Shadcn Sheet-Komponente)

### Traverse-Liste (`BeamList.tsx`)
- Analog zu Stützen-Liste
- Spalten: Label | Von | Bis | Typ | Auskr. L | Auskr. R | Lasten | ✏️ | 🗑️

---

## Schritt 5: 2D-Rendering (SVG)

Erstelle `components/rendering/StructureRenderer.tsx`.

**Draufsicht (Grundriss):**
- Koordinatensystem: x nach rechts, y nach oben
- Stützen als ausgefüllte Kreise (●), Farbe je nach Status: grau (unberechnet), grün (OK), rot (NICHT OK)
- Traversen als Linien zwischen den Stützen
- Kippachse des maßgebenden Lastfalls als gestrichelte rote Linie
- Windpfeil zeigt maßgebende Windrichtung
- Labels an Stützen und Traversen
- Automatische Skalierung auf den verfügbaren Container

**Elevation (Seitenansicht):**
- Schematisch, nicht maßstäblich in Y
- Zeigt: Stütze als vertikale Linie, Traverse als horizontale Linie oben drauf
- Hängelasten als hängende Pfeilsymbole ↓ mit Gewichtsangabe
- Windpfeil seitlich mit qp-Wert

Beide Renderer sind **rein deklarativ** – sie bekommen `input` und `result` als Props,
kein eigener State.

---

## Schritt 6: Ergebnisanzeige

### ResultSummary (oberste Ebene)

```
┌─────────────────────────────────────┐
│  🟢 STANDSICHER                      │
│  Erforderlicher Ballast gesamt:      │
│  1.250 kg                            │
│                                      │
│  Maßgebend: Kippen – Wind +Y         │
└─────────────────────────────────────┘
```

Bei NICHT OK: rot, mit Liste der Fehler.

### BallastTable
Tabelle: Stütze | Erforderlich | Vorhanden | Zusätzlich nötig
Zeilen mit Zusatzbedarf > 0: gelb hinterlegt.

### TippingResults
Vier Karten nebeneinander (Wind +X / +Y / -X / -Y):
- Ausnutzung als Fortschrittsbalken
- Kippachse angezeigt
- Maßgebende Karte: farbiger Rahmen

---

## Schritt 7: PDF-Report

Erstelle `components/report/ReportDocument.tsx` mit `@react-pdf/renderer`.

**Report-Struktur:**
```
Seite 1: Deckblatt
  - Cologne Hunters Logo (base64)
  - Projektname, Datum, Verantwortliche Person
  - Disclaimer: "Planungsgrundlage – kein geprüfter Standsicherheitsnachweis..."

Seite 2: Systemübersicht
  - Tabelle: Windzone, Geländekategorie, Stützenanzahl, Traversentypen
  - SVG-Rendering als eingebettetes Bild (Grundriss)
  - Tabelle: Alle Lasten (Eigengewicht + Hängelasten + Windlasten)

Seite 3: Nachweise
  - Traversenauslastung (Tabelle mit η-Werten und ✓/✗)
  - Knicknachweis Stützen (Tabelle)
  - Kippsicherheit alle 4 Richtungen (Tabelle mit η-Werten)
  - Gleitnachweis

Seite 4: Ergebnis
  - Ballasttabelle je Stütze
  - Normenverzeichnis
  - Unterschriftszeile
```

`ReportButton.tsx` löst Download aus: `report_[Projektname]_[Datum].pdf`

---

## Schritt 8: VW JSON-Import

Erstelle `lib/importVW.ts`:

```typescript
export function importFromVW(data: VWExportData): StructureInput
```

- Konvertiert mm → m (alle Längenangaben)
- Mappt `trussType`-Strings auf `TrussType`-Enum (case-insensitive, mit Fallback + Warning)
- Gibt ein vollständiges `StructureInput` zurück mit leeren Pflichtfeldern (projectName, windZone etc.)
  die der User dann noch ausfüllt

Upload-Button in der UI: akzeptiert nur `.json`, zeigt Fehler wenn Format nicht passt.

---

## Wichtige Hinweise

- Importiere **niemals** direkt aus `calc-engine/src/wind/`, `calc-engine/src/beam/` etc.
  Nur aus `calc-engine/src/index.ts`
- Alle Texte in der UI auf **Deutsch**
- Keine hardgecodeten Farben – nur Tailwind-Klassen
- Mobile-first: alle Komponenten funktionieren ab 375px Breite
- Kein localStorage – State lebt nur im Arbeitsspeicher der Session
