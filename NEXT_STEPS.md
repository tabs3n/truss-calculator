# Truss Calculator – Status & Roadmap

> Stand: 2026-05-14
> Letzte Session: Anzeige-Bugs im Report behoben, Streckenlast + Multi-Support hinzugefügt, Umlaute korrigiert, Norm-Audit durchgeführt.

---

## ✅ In dieser Session erledigt (Commits ffa991c · 74cf838 · 40d86f2 · 4d89d49)

### Umlaute (commit `ffa991c`)
- 25 Dateien: `Stuetze → Stütze`, `fuer → für`, `Hoehe → Höhe`, `groesser → größer`, `Flaeche → Fläche`, `Laenge → Länge`, `massgebend → maßgebend`, `Fussdetail → Fußdetail`, etc.
- Code- und Test-Strings synchron (z.B. `'Mindestens 2 Stützen erforderlich'` in `index.ts`, `tippingCheck.ts`, `integration.test.ts`).

### Report-Display-Bug (commit `74cf838`)
- **Bug**: `Mk = 76,18 · Ms = 8,27 → eta = 24,89` war mathematisch inkonsistent (76,18/8,27 = 9,21, nicht 24,89).
- **Ursache**: Charakteristische Werte angezeigt, aber `eta` mit Bemessungswerten (γQ × Dyn = 1,80 auf Mk; γG,inf = 0,90 auf Ms).
- **Fix**:
  - `TippingDirectionResult` um `designHorizontalForceKN`, `designTippingMomentKNm`, `designStabilizingMomentKNm`, `effectiveLeverArmM`, `totalEquVerticalReactionKN`, `applicationHeightM` erweitert.
  - `SupportResult.equVerticalReactionKN` (γG,inf=0,9) ergänzt.
  - `CalculationResult.designFactors` (γG, γG,inf, γQ, Dyn, γM1, γM2, horizontalDesignFactor) für volle Report-Transparenz.
  - Report zeigt jetzt `Mk,d = Fw,k × γQ × Dyn × h` und `Ms,d = ΣRz,EQU × a`. Formel `eta = Mk,d / Ms,d` ist konsistent.
- **Outrigger-Warnung**: SupportForm zeigt amberbox bei BASEPLATE ohne Outrigger mit Hinweis auf vergrößerten Kipparm.

### Streckenlast + Multi-Support (commit `40d86f2`)
- **`DistributedLoad`-Typ** (`startPositionM`, `endPositionM`, `loadKgPerM`) auf `Beam.distributedLoads?`.
- **`Beam.supportIds?: string[]`** (≥2 Stützen, optional, default `[startSupportId, endSupportId]`).
- **`calculateBeam`** nimmt optional `distributedSegments: DistributedLoadSegment[]`.
- **Multi-Support-Berechnung in `index.ts`**: Splittet Träger in N–1 Einfeldträger-Segmente, aggregiert max-Werte. Konservative Vereinfachung (überschätzt M gegenüber echtem Durchlaufträger).
- **Streckenlast-Bemessung**: γQ × Dyn = 1,80 (variabel).

### UI-Update (commit `4d89d49`)
- `BeamForm`: Zwischenstützen-Sektion (Reihenfolge erhalten) und Streckenlasten-Sektion (Start/Ende/kg·m⁻¹).
- `types-bridge`: `DistributedLoad` und `DesignFactors` exportiert.
- Report-Skizze von 340×227 auf 500×320 vergrößert.
- Lasten-Tabelle aufgeteilt in Punkt- und Streckenlasten.
- Beam-Übersicht zeigt Anzahl Stützen und Streckenlasten.

### Norm-Audit (kein Code, dokumentiert)
- ✅ DIN EN 1991-1-4 (Wind): qp, cr, kr, Iv korrekt
- ✅ DIN EN 1990 Tab. A.1.2(A): γG=1,35 / γG,inf=0,90 / γQ=1,50 korrekt
- ✅ DIN EN 17879 (Indoor): Imperfektion 2,5%, Anprall 1 kN @ 1 m, Ersatzfläche 0,13/0,06 kN·m⁻²
- ✅ DIN EN 13814 (Reibung): Preset-Tabelle korrekt
- ✅ DGUV 215-313: Dynamikzuschlag 1,20
- ✅ EC9 6.3.1: χ-Verfahren mit α, λ̄₀ pro Material korrekt
- **→ Die 44 t Ballast im Test-Case waren rechnerisch korrekt. Der Bug saß nur im Display.**

---

## 🔥 Offene Bugs (Code-Korrektheit)

### Bug 1: `maxShearForceKN` Verdopplung am rechten Auflager
**Datei**: `packages/calc-engine/src/beam/beamCalculation.ts` Zeile ~180-188

**Symptom**: Bei Einfeldträger ohne rechte Auskragung wird die Reaktion am rechten Auflager *bei* `x = span` (letzter Sample-Punkt) auf die Schubkraft angerechnet, obwohl der Träger dort endet. Ergebnis: `maxShearForceKN` ist ca. doppelt so hoch wie korrekt.

**Beispiel**: P=10 kN bei Mitte, L=6m → reactionStart = reactionEnd = 5 kN, wahre max-Shear = 5 kN. Code liefert `|0 + 5 - 10 - 5| = 10 kN`.

**Praktische Auswirkung**: `eta Quer` ist immer ca. 2× zu hoch. Für H40V (V_Rd = 18,94 kN) führt das selten zu falschen NICHT-OK-Ergebnissen, aber die angezeigten Werte sind unkorrekt.

**Fix-Ansatz**:
```typescript
// Im Sample-Loop: rechte Reaktion NUR berücksichtigen wenn x > span
// (nicht bei x === span, weil der Träger dort gerade endet)
if (x > span) shearKN -= reactionEnd
// Analog: linke Reaktion nur bei x > 0 (statt x >= 0), aber das ändert
// das Verhalten am linken Auflager — Reaktion ist dort ja real wirksam.
// Sauberere Lösung: berechne Shear KURZ VOR jedem Sample-Punkt (left-limit)
// und KURZ DANACH (right-limit), nimm das Maximum von |beiden|.
```

**Test-Vorgabe** (in `beamCalculation.test.ts`):
```typescript
it('Einzellast 10 kN in Mitte L=6m: V_max = 5 kN (nicht 10)', () => {
  const result = calculateBeam('PROLYTE_H40V', 6, 0, 0, [{ positionM: 3, forceKN: 10 }], 0)
  expect(result.maxShearForceKN).toBeCloseTo(5, 1)
})

it('Streckenlast q=2 kN/m, L=4m: V_max = 4 kN (an den Auflagern)', () => {
  const result = calculateBeam('PROLYTE_H40V', 4, 0, 0, [], 2)
  expect(result.maxShearForceKN).toBeCloseTo(4, 1)
})
```

### Bug 2: Uniforme Lastverteilung auf Stützen
**Datei**: `packages/calc-engine/src/index.ts` Zeile ~277-284

```typescript
const reactionPerSupportSTR = totalPermanentSTR_KN / input.supports.length
const reactionPerSupportEQU = totalPermanentEQU_KN / input.supports.length
```

**Symptom**: Eine Stütze direkt unter einer 500-kg-Last bekommt rechnerisch gleich viel ab wie eine 5 m entfernte Stütze.

**Auswirkung**:
- **Knicknachweis** ist nicht maßgeblich (alle Stützen gleich belastet, statt der stärksten zu warnen).
- **Kippnachweis** Mittelung der Reaktionen verzerrt Hebelarme.
- **Ballastempfehlung** verteilt Ballast gleichmäßig statt auf die wirklich kippkritischen Stützen.

**Fix-Ansatz**: `reactionStartKN` und `reactionEndKN` aus `calculateBeam`-Result nutzen. Für Multi-Support pro Segment ermitteln und auf die jeweilige Stütze addieren (innere Stützen bekommen Beitrag aus zwei Segmenten).

**Test-Vorgabe**:
```typescript
it('Asymmetrische Last auf 2 Stützen: Reaktionen unterschiedlich', () => {
  // Last 100 kg bei 1m von Stütze A entfernt (Spannweite 5m)
  // Stütze A bekommt 80%, Stütze B 20%
  // ...
  expect(result.supports[0].verticalReactionKN).toBeGreaterThan(result.supports[1].verticalReactionKN * 3)
})
```

---

## 🎯 Feature-Backlog (priorisiert)

### Hoch-Impact

1. **Konfigurations-Vorlagen** (~2 h)
   - 2-Stützen-Goalpost (8m × 5m, BANNER)
   - 4-Stützen-Groundsupport (FOH-Standard)
   - Tower mit Outriggers
   - Indoor-Bühne mit Roof
   - UI: Button-Grid auf `/calculator`, klick → vorausgefüllte Konfiguration in den State.

2. **PLZ → Windzone-Lookup** (~3 h, im CLAUDE.md schon als TODO)
   - PLZ-Eingabe statt Zonen-Dropdown
   - Daten aus DIN EN 1991-1-4 NA.A (Anhang A) – als Lookup-Tabelle oder JSON.
   - Fallback auf Zonen-Dropdown.

3. **Was-wäre-wenn-Vergleich im Report** (~4 h)
   - Zweite Spalte im Ballast-Block: „Mit 1,5 m Outrigger" oder „Mit Concrete Blocks"
   - Engine-API: `calculateVariants(input, variants[])` gibt Result-Array zurück
   - Report rendert Tabelle „Variante | Erf. Ballast | Δ vs. Baseline"

### Engineering-Genauigkeit

4. **Echter Durchlaufträger** (~1 Tag)
   - 3-Momenten-Gleichung (Clapeyron) für statisch unbestimmte Multi-Support-Träger
   - Reduziert M_max um ~25 % gegenüber jetziger Einfeldträger-Approximation
   - Test-Vorgabe: 3 Stützen, gleichmäßige Last → M_Stütze ≈ qL²/10, M_Feld ≈ qL²/14 (statt qL²/8 bei Einfeld)

5. **Schneelast nach DIN EN 1991-1-3** (~1 Tag)
   - Snow-Zone (1-3) + Geländehöhe → s_k → Lastansatz auf Dach-/Trussflächen
   - Optional, da Cologne Hunters vermutlich kein Winter-Outdoor-Kerngeschäft

6. **Lokale Stützen-Windfläche realistischer** (~2 h)
   - Aktuell pauschal `0,4 × h` für Stützen-cw-Fläche
   - Bei Tower-Profilen (T-Riggern, S52F) reale Profilbreite verwenden
   - Tabelle in `materials/database.ts` ergänzen

### Datenbank

7. **Traversen-Datenbank vervollständigen**
   - 6 von 9 Trussen haben noch `// TODO: Herstellerdaten eintragen` (PROLYTE_H30V/S40T/S52F, EUROTRUSS_TD44/ST50, PIPE_50_3_ALU)
   - Verifizierte Datenblätter (Systemstatik Prolyte/Eurotruss) sind Pflicht für rechtliche Belastbarkeit
   - Pro Eintrag: Quelle (PDF-Name + Seite) als Kommentar

### Report

8. **Grundriss-View** zusätzlich zur Iso-Skizze (~3 h)
   - Draufsicht mit eingezeichneten Kippachsen für alle 4 Windrichtungen
   - Komponente analog zu `IsometricSketch.tsx` aber mit nur X/Y-Projektion
   - In `ReportDocument.tsx` neben Iso-Skizze rendern

9. **QR-Code mit Berechnungs-Hash** (~1 h)
   - SHA-256 über `JSON.stringify(input)` + `calculatedAt`
   - QR-Code mit Hash + URL zur Verifikations-Seite
   - Verifikations-Endpoint: zeigt Hash an, ermöglicht Re-Berechnung des Inputs
   - Package: `qrcode` (npm)

10. **Echte DIN-Symbole** statt ASCII (~30 min)
    - `γ`, `Σ`, `η`, `μ`, `λ̄`, `²`, `³` statt `gamma`, `sigma`, `eta`, `mu`
    - Helvetica/Arial reicht, Unicode wird von @react-pdf/renderer unterstützt
    - Suche und ersetze in `ReportDocument.tsx`

### UX / Persistenz

11. **localStorage Auto-Save** (~1 h)
    - `useEffect`-Hook in `useCalculation`, der bei Input-Änderung in `localStorage.truss-calc-draft` speichert
    - Beim Mount: Draft laden falls vorhanden
    - „Verworfen"-Button um neu zu starten

12. **JSON-Export/Import** der Konfiguration (~2 h)
    - Button „Konfiguration speichern" → `.json` Download
    - Button „Konfiguration laden" → File-Picker
    - Schema-Validierung (Zod oder eigener Type-Guard)

13. **Drag & Drop für Stützen-Positionen** (~1 Tag)
    - Im `StructureRenderer` Stützen-Punkte draggable machen
    - Mouse-Move updated `support.position`
    - Snap auf 0,25-m-Raster optional

### Tests

14. **Vitest-Tests für neue Features**
    - Streckenlast: Handrechnung q=2 kN/m über [1m, 3m] auf 5m Träger
    - Multi-Support: 3-Stützen-Konfig vergleichen mit zwei separaten Beams (sollte identisch sein)
    - Shear-Bug-Test (siehe Bug 1)
    - Lastverteilungs-Test (siehe Bug 2)
    - Streckenlast in `index.ts`: Beam mit Streckenlast → totalPermanent korrekt

---

## 🛠️ Tech Debt

- `IsometricSketch.tsx` interpoliert Lastpositionen über `getBeamSupports` (nur start/end) — bei nicht-kollinearen Multi-Support-Trägern leicht ungenau (in Praxis aber kollinear)
- `getTippingProof`/`getSlidingProof` in `ReportDocument.tsx` sind nach dem Display-Fix nur noch teilweise genutzt (z.B. nur für `tippingAxisLabel`), könnten aufgeräumt werden
- `AGENTS.md` im `web-app/` warnt vor Next.js-Version 16.2.6, die von Trainingsdaten abweicht — bei jeder Next.js-Änderung `node_modules/next/dist/docs/` konsultieren
- Vw-export Python-Script noch nicht durchgeprüft

---

## 🧪 Verifikation

Nach jeder Änderung:

```bash
cd packages/calc-engine
pnpm install
pnpm test               # vitest run

cd ../web-app
pnpm install
pnpm typecheck          # oder tsc --noEmit
pnpm build              # next build
```

Web-App lokal starten:
```bash
cd packages/web-app
pnpm dev
```

Hosted: https://truss-calculator-web-app.vercel.app

---

## 📝 Nützliche Datei-Pfade

| Zweck | Datei |
|---|---|
| Engine-Public-API | `packages/calc-engine/src/index.ts` |
| Typen (Contract zur Web-App) | `packages/calc-engine/src/types.ts` |
| Beam-Statik | `packages/calc-engine/src/beam/beamCalculation.ts` |
| Kippnachweis | `packages/calc-engine/src/tipping/tippingCheck.ts` |
| Wind-Berechnung | `packages/calc-engine/src/wind/windLoad.ts` |
| Indoor-Lasten | `packages/calc-engine/src/loads/indoorLoads.ts` |
| Lastkombinationen | `packages/calc-engine/src/loads/loadCombinations.ts` |
| Knicken | `packages/calc-engine/src/stability/bucklingCheck.ts` |
| Materialdatenbank | `packages/calc-engine/src/materials/database.ts` |
| Report-PDF | `packages/web-app/components/report/ReportDocument.tsx` |
| Skizze | `packages/web-app/components/report/IsometricSketch.tsx` |
| Beam-Formular | `packages/web-app/components/input/BeamForm.tsx` |
| Stützen-Formular | `packages/web-app/components/input/SupportForm.tsx` |
| Type-Bridge calc-engine ↔ web-app | `packages/web-app/lib/types-bridge.ts` |

---

## 🎬 Empfohlene nächste Session

**Reihenfolge**:

1. **Bug 1 fixen** (Shear-Verdopplung) — 30 min, weil eta-Quer-Werte aktuell verzerrt sind
2. **Bug 2 fixen** (Lastverteilung aus Beam-Reactions) — 1-2 h, weil Kippen/Knicken davon abhängen
3. **Tests** für 1 + 2 ergänzen
4. **Vorlagen** hinzufügen — sofort sichtbarer UX-Win für den Nutzer

Danach Feature-Backlog nach Bedarf.
