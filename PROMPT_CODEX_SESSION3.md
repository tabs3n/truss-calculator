# Codex Session 3 — Engine, Report, Forms

> **Selbstständig ausführbarer Prompt. Kein Kontext aus vorheriger Session nötig.**
> **Pflicht-Lesung vor Start**: `PROGRESS.md` (root) für Konflikt-Vermeidung mit parallelem Worker.

---

## Repo

`https://github.com/tabs3n/truss-calculator` — TypeScript Monorepo, calc-engine (Vitest) + Next.js 16 web-app (Vercel).

```
packages/
├── calc-engine/   # pure functions, DIN/EC-Berechnungen
└── web-app/       # Next.js UI, importiert aus calc-engine
```

## Worker-Aufteilung (siehe PROGRESS.md)

**Codex (du)** → Engine, Report, Forms.
**Claude (parallel)** → Hooks, Renderer, Page-Layout, Mobile, 3D, Drag&Drop, Versioning.

**Niemand fasst Dateien außerhalb seines Bereichs an.** Vor jeder größeren Änderung `git status` prüfen und PROGRESS.md aktualisieren.

---

## 🎯 Deine 6 Aufgaben in dieser Reihenfolge

### Aufgabe 2 — Tooltips mit Norm-Referenzen

**Ziel**: Hover-Tooltips an Formularfeldern, die die zugrunde liegende Norm zitieren. Verkauft das Tool als „normbasiert".

**Schritte**:

1. **Neue Datei** `packages/web-app/components/ui/Tooltip.tsx`:
   - Einfacher controlled Tooltip mit `<button type="button">` als Trigger und absolut positioniertem Popup.
   - Props: `text: string`, `children: ReactNode` (der Trigger). Trigger ist ein „(?)"-Icon-Button.
   - Keyboard-zugänglich, schließt bei Click-outside/Escape.

2. **Neue Datei** `packages/web-app/lib/tooltip-texts.ts` mit allen Norm-Texten:
   ```typescript
   export const TOOLTIP_TEXTS = {
     windZone: "DIN EN 1991-1-4/NA Tab. NA.B.3 — Grundwindgeschwindigkeit vb je Windzone (22,5 – 30 m/s).",
     terrainCategory: "DIN EN 1991-1-4 Tab. 4.1 — Geländekategorie I (Küste) bis IV (Stadt). Beeinflusst z0, zmin und Turbulenz.",
     friction: "DIN EN 13814 Tab. 3 — Reibwerte für Kontaktflächen-Paarungen.",
     baseplateOutrigger: "Wirksamer Hebelarm gegen Kippen = Bodenplattenkante oder Outrigger-Länge (Maximum).",
     dynamicFactor: "DGUV Information 215-313 — +20% Dynamikzuschlag auf alle veränderlichen Lasten bei Event-Strukturen.",
     gammaG: "DIN EN 1990 Tab. A.1.2(B) — Teilsicherheitsbeiwert ständige Lasten (γG = 1,35 ungünstig / 0,90 günstig in EQU).",
     gammaQ: "DIN EN 1990 Tab. A.1.2(B) — Teilsicherheitsbeiwert veränderliche Lasten (γQ = 1,50 ungünstig).",
     windMode: "DIN EN 1991-1-4 §4.2 — Ungünstigste Richtung maßgebend. AUTO prüft alle 4 Hauptrichtungen, MANUAL nur ausgewählte.",
     // … weitere nach Bedarf
   } as const
   ```

3. **Anwenden** in `ProjectForm.tsx`, `SupportForm.tsx`, `BeamForm.tsx`:
   - Direkt neben Feld-Labels: `<label>Windzone <Tooltip text={TOOLTIP_TEXTS.windZone} /></label>`
   - Mindestens: Windzone, Geländekategorie, Reibwert, Outrigger, Windrichtungs-Modus, Indoor-Tore.

**Acceptance**: Hover/Klick auf „(?)" zeigt Norm-Text. Keyboard-accessible. Schließt bei Outside-Click.

---

### Aufgabe 10 — Eingabe-Validierung mit Echo

**Ziel**: Sofortiges Feedback bei unsinnigen Eingaben mit konkretem Vorschlag.

**Schritte**:

1. **Neue Datei** `packages/calc-engine/src/validation.ts` mit zentralen Validatoren:
   ```typescript
   export interface ValidationIssue {
     field: string          // z.B. "support.height"
     severity: "error" | "warning"
     message: string
     suggestion?: string
   }

   export function validateStructureInput(input: StructureInput): ValidationIssue[] {
     // - Stütze.height in [0.5, 20] m sonst error
     // - Beam-Spannweite > 12 m → warning ("PROLYTE_H30V erlaubt max 8 m frei")
     // - Support-Position-Duplikate erkennen
     // - Distributed-Load-Range außerhalb Beam → error
     // - cantileverStart/End > spanLength/2 → warning
     // - … weitere
   }
   ```

2. **Tests** in `packages/calc-engine/tests/validation.test.ts`.

3. **UI-Anzeige**: In SupportForm/BeamForm/ProjectForm jeweils:
   - Pro Feld eine `validateField` Funktion die einen `ValidationIssue | null` zurückgibt
   - Anzeige unter dem Feld in rot (error) oder amber (warning)
   - Nutze bestehende `<ErrorText>`-Komponente, ergänze um `tone: "error" | "warning"`

4. **Globaler Issue-Listener** in CalculatorPage: Wenn der Input einen „error"-Issue hat, zeigt der „Berechnen"-Button einen Disable-Tooltip „X Eingabefehler — bitte korrigieren".

**Acceptance**: Eingabe `Stütze.height = 0` → unter dem Feld erscheint „Höhe muss zwischen 0,5 und 20 m liegen". Berechnen-Button deaktiviert solange Errors da sind.

---

### Aufgabe 9 — Snow-Load UI Integration

**Ziel**: Schneelast nach DIN EN 1991-1-3 vollständig im Workflow.

**Schritte**:

1. **`packages/calc-engine/src/types.ts`** erweitern:
   ```typescript
   export interface SnowConfig {
     enabled: boolean
     zone: '1' | '1a' | '2' | '2a' | '3'
     altitudeM: number
     /** Dachneigung (0 = flach) */
     roofPitchDeg: number
     /** WINDIG | NORMAL | GESCHUETZT */
     exposure: 'WINDIG' | 'NORMAL' | 'GESCHUETZT'
     /** Optional: Dachfläche in m² (wenn Dach mit modelliert wird) */
     roofAreaM2?: number
   }

   export interface StructureInput {
     // … bestehend
     snowConfig?: SnowConfig
   }
   ```

2. **`packages/calc-engine/src/index.ts`** integrieren:
   - Wenn `snowConfig?.enabled && environment === 'OUTDOOR'`: aus `calculateSnowLoad(snowConfig)` die roofLoadKNm2 holen, mit roofAreaM2 multiplizieren, als veränderliche Last (γQ × Dyn) auf totalPermanentSTR_KN addieren.
   - Im Result einen neuen Block `snowLoad?: SnowLoadDetails` (s_k, μ, C_e, C_t, kN/m², total kN).

3. **`packages/web-app/components/input/ProjectForm.tsx`**:
   - Neue Sektion „Schneelast (optional)" nur sichtbar bei Outdoor.
   - Felder: Aktiv-Checkbox, Zone-Dropdown, Höhe ü. NN, Dachneigung, Exposition, Dachfläche m².
   - Mit Tooltips (DIN EN 1991-1-3 Referenz).

4. **`packages/web-app/components/report/ReportDocument.tsx`**:
   - Neuer Formula-Block „Schneelast" im Rechnerische-Nachweise-Block wenn snowConfig aktiv.
   - Zeile: `s = μ × C_e × C_t × s_k`.

5. **Tests**: integration.test.ts erweitern um Snow-Outdoor-Case.

**Acceptance**: Outdoor-Test mit Zone 3, 500 m, 10 m² Dach: snowLoad-Beitrag erscheint in totalPermanent.

---

### Aufgabe 6 — Schnittkraft-Diagramme im Report

**Ziel**: M-Verlauf, V-Verlauf, Biegelinie pro Traverse als SVG im PDF.

**Schritte**:

1. **`packages/calc-engine/src/beam/beamCalculation.ts`** erweitern:
   - `BeamInternalForces.samples?: Array<{ x: number, momentKNm: number, shearKN: number, deflectionMm: number }>`
   - Die bereits berechneten `momentSamples` mitliefern, dazu shearKN und deflectionMm pro Sample.
   - Anzahl Samples ggf. reduzieren auf ~50 für PDF-Größe.

2. **`packages/calc-engine/src/types.ts`** `BeamResult` erweitern:
   - `samples?: ReadonlyArray<{ xM: number, momentKNm: number, shearKN: number, deflectionMm: number }>`

3. **`packages/calc-engine/src/index.ts`** im Beam-Loop:
   - Für jeden Beam: Sample-Daten des **maßgebenden Segments** speichern (das mit max bending utilization).

4. **Neue Datei** `packages/web-app/components/report/BeamDiagrams.tsx`:
   - Eine Komponente die für 1 Beam-Result drei kleine SVG-Diagramme rendert:
     - **M-Verlauf**: Biegemoment vs. x — Negative Werte (Kragmomente) unter der Nulllinie, Maximalwert beschriftet
     - **V-Verlauf**: Schubkraft vs. x — Sprünge an Punktlasten/Auflagern
     - **Biegelinie**: Durchbiegung vs. x — überhöht dargestellt
   - Achsen mit „m" und „kNm" / „kN" / „mm".
   - Maximalwerte als Marker beschriftet.

5. **`ReportDocument.tsx`** einbinden:
   - Eigene Seite nach „Nachweise"-Seite: „Schnittkraftverläufe je Traverse"
   - Pro Beam: Header + die drei Diagramme nebeneinander/untereinander.

**Acceptance**: PDF zeigt M-Verlauf für maßgebenden Beam mit korrektem Maximum am Lastangriffspunkt.

---

### Aufgabe 7 — Was-wäre-wenn-Vergleich

**Ziel**: Report-Seite mit Optimierungspotenzial. Mehrere Varianten der Konfiguration nebeneinander.

**Schritte**:

1. **Neue Funktion** `packages/calc-engine/src/variants.ts`:
   ```typescript
   export interface Variant {
     label: string
     description: string
     transform: (input: StructureInput) => StructureInput
   }

   export const STANDARD_VARIANTS: Variant[] = [
     {
       label: "Mit Outrigger 1,5 m",
       description: "Alle BASEPLATE-Stützen bekommen 1,5 m Outrigger",
       transform: (input) => ({ ...input, supports: input.supports.map(s =>
         s.footType === 'BASEPLATE' ? { ...s, outriggerLength: 1.5 } : s
       )}),
     },
     {
       label: "Mit Concrete Blocks",
       description: "Alle Stützen bekommen Concrete Block 1250 kg statt Bodenplatte",
       transform: (input) => ({ ...input, supports: input.supports.map(s =>
         s.footType === 'BASEPLATE' ? { ...s, footType: 'CONCRETE_BLOCK_1250' } : s
       )}),
     },
     // … 2-3 weitere
   ]

   export function calculateVariants(input: StructureInput, variants: Variant[]): Array<{
     variant: Variant
     result: CalculationResult
   }>
   ```

2. **Neue Komponente** `packages/web-app/components/report/VariantsComparison.tsx`:
   - Tabelle: Variante | Ballast | Δ vs. Baseline | overallOk
   - Jeweils kurze Beschreibung warum die Variante hilft.

3. **`ReportDocument.tsx`**:
   - Eigene Seite „Optimierungspotenzial" am Ende (vor Ballast/Signatur).
   - Nur rendern wenn aktuelles Ergebnis NICHT ok (sonst keine Optimierung nötig).

**Acceptance**: Bei 44-t-Test-Case zeigt VariantsComparison: „Mit Outrigger 1,5 m: ~7,5 t (−83 %)".

---

### Aufgabe 15 — Materialdatenbank vervollständigen

**Ziel**: Alle 9 Traversen-Typen mit verifizierten Daten aus Hersteller-Statiken.

**Schritte**:

1. **`packages/calc-engine/src/materials/database.ts`**:
   - Für jeden noch mit `// TODO: Herstellerdaten eintragen` markierten Eintrag:
     - PROLYTE_H30V, PROLYTE_S40T, PROLYTE_S52F, EUROTRUSS_TD44, EUROTRUSS_ST50, PIPE_50_3_ALU
   - Quellen: Prolyte Systemstatik PDFs, Eurotruss Datenblätter (öffentlich auf Hersteller-Websites).
   - **WICHTIG**: Wenn echte Werte nicht verfügbar sind: konservative Schätzung mit `// SCHÄTZUNG: …, ersetzen sobald Datenblatt vorliegt` Kommentar.
   - PIPE_50_3_ALU: kann analytisch aus Geometrie + Material berechnet werden (Iy = π/64 × (D⁴ − d⁴)).

2. **Tests** in `materials.test.ts` erweitern: alle 9 Typen müssen plausible Werte (>0) haben für alle Pflichtfelder.

3. **Quellen-Kommentare** im Code:
   ```typescript
   PROLYTE_H30V: {
     // Quelle: Prolyte Group, "Statics Manual H30V", Stand 2024 (PDF S. 12)
     label: 'Prolyte H30V',
     ...
   }
   ```

**Acceptance**: Kein `TODO: Herstellerdaten eintragen` mehr in database.ts. Alle Tests bestehen.

---

## ⚠️ Constraints für Codex

- **NICHT anfassen** (gehört Claude):
  - `packages/web-app/hooks/useCalculation.ts`
  - `packages/web-app/app/globals.css`
  - `packages/web-app/components/rendering/*`
  - `packages/web-app/app/calculator/page.tsx` (nur Layout — Claude macht Mobile)
  - Alle NEUEN Komponenten in `components/rendering/` und `components/ui/CalculationHistory.tsx`

- **Keine Breaking Changes** in `CalculationResult`, `StructureInput`, `Beam`, `Support` Schnittstellen — nur additive Änderungen (neue optionale Felder).
- **Keine** `any`-Types, keine Production-Logs (`console.log`)
- **Deutsch** in Kommentaren, **Englisch** in Bezeichnern
- **Normreferenzen** als Kommentar bei jeder Berechnungs-Formel
- Umlaute (ä, ö, ü, ß) immer verwenden, niemals ASCII-Ersatz (ae, oe, ue, ss)

## Commit-Struktur

Bitte 6 getrennte Commits in der Reihenfolge:

1. `feat(ui): Tooltip-Primitive + Norm-Referenzen in Formularen` (Aufgabe 2)
2. `feat(engine): zentrale Eingabevalidierung mit Echo` (Aufgabe 10)
3. `feat(snow): DIN EN 1991-1-3 Schneelast komplett im Workflow` (Aufgabe 9)
4. `feat(report): Schnittkraft-Diagramme M/V/w je Traverse` (Aufgabe 6)
5. `feat(report): Was-wäre-wenn-Vergleich Optimierungspotenzial` (Aufgabe 7)
6. `feat(materials): verifizierte Datenbank-Einträge für alle Traversen` (Aufgabe 15)

Jeder Commit muss eigenständig grün sein.

## Progress-Tracking

Nach jedem fertigen Commit:
1. **`PROGRESS.md`** updaten (Tabelle „Codex"): Status auf ✅, Commit-Hash eintragen, kurze Notiz.
2. Falls Tokens knapp werden: PROGRESS.md erstmal pushen mit Stand, so kann morgen weitergemacht werden.

## Definition of Done

- Alle Tests bestehen (`pnpm test` in calc-engine)
- TypeScript clean (`pnpm typecheck` in web-app)
- PROGRESS.md spiegelt den realen Stand
- 6 Commits gepusht
