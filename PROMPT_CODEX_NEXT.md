# Codex-Übergabe: Truss Calculator — Bug-Fixes & Quick-Wins

> Selbstständig ausführbarer Prompt. Kein Kontext aus vorheriger Session nötig.

---

## Repo

`https://github.com/tabs3n/truss-calculator` — TypeScript Monorepo, calc-engine (Vitest) + Next.js 16 web-app (Vercel).

```
packages/
├── calc-engine/   # pure functions, DIN/EC-Berechnungen
└── web-app/       # Next.js UI, importiert nur aus calc-engine
```

## Was bereits funktioniert

- ✅ Wind nach DIN EN 1991-1-4, γ-Faktoren nach DIN EN 1990 Tab. A.1.2(A)
- ✅ Kippnachweis EQU mit Bemessungswerten (γQ × Dyn = 1,80, γG,inf = 0,90)
- ✅ Gleitnachweis DIN EN 13814 mit Reibwerten Tabelle 3
- ✅ Knicken EC9 6.3.1 χ-Verfahren
- ✅ Indoor nach DIN EN 17879 (Imperfektion / Anprall / Ersatzfläche)
- ✅ Streckenlasten (DistributedLoad mit kg/m über Abschnitt)
- ✅ Multi-Support-Traversen (Beam.supportIds, intern als Einfeldträger-Aneinanderreihung berechnet — konservativ)
- ✅ Report-PDF mit Bemessungswerten (Mk,d / Ms,d / eta konsistent)
- ✅ Outrigger-Warnung im SupportForm

Details in `NEXT_STEPS.md` (gleiches Repo, root level).

---

## Auftrag: 4 Aufgaben in dieser Reihenfolge

### Aufgabe 1 — Bug: Shear-Force-Verdopplung am rechten Auflager

**Datei**: `packages/calc-engine/src/beam/beamCalculation.ts`

**Symptom**: `maxShearForceKN` ist ca. 2× zu groß bei Einfeldträgern. Beispiel 10 kN bei Mitte L=6m: erwartet V_max = 5 kN, Code liefert 10 kN.

**Ursache**: Der Sample-Loop visitiert auch `x = span` (letzter Punkt) und addiert dort `reactionEnd` auf den Shear — aber der Träger endet ja genau hier, also gehört diese Reaktion nicht mehr zur Schubkraft innerhalb des Balkens.

**Fix**: Im Sample-Loop bei der Schubkraft-Berechnung die Bedingung `x >= span` durch `x > span` ersetzen (sodass die rechte Reaktion nur in der rechten Auskragung wirksam ist, nicht am Auflager selbst). Für Moment-Berechnung bleibt `x >= span` korrekt, da dort `(x - span) = 0` und damit kein falscher Beitrag.

Sauberere Alternative: Shear an jedem Punkt aus *zwei* Limites bestimmen (kurz vor und kurz nach jedem diskreten Ereignis), Maximum von |beiden| nehmen.

**Tests** (in `packages/calc-engine/tests/beamCalculation.test.ts` ergänzen):

```typescript
describe('maxShearForceKN — korrekt am Auflager', () => {
  it('Einzellast 10 kN bei Mitte, L=6m: V_max = 5 kN', () => {
    const result = calculateBeam('PROLYTE_H40V', 6, 0, 0, [{ positionM: 3, forceKN: 10 }], 0)
    expect(result.maxShearForceKN).toBeCloseTo(5, 1)
  })

  it('Streckenlast q=2 kN/m, L=4m: V_max = 4 kN', () => {
    const result = calculateBeam('PROLYTE_H40V', 4, 0, 0, [], 2)
    expect(result.maxShearForceKN).toBeCloseTo(4, 1)
  })

  it('Kragarm: 5 kN am Auskragungs-Ende, L=6m, cant=2m: V_max = 5 kN (am inneren Auflager)', () => {
    const result = calculateBeam('PROLYTE_H40V', 6, 2, 0, [{ positionM: -2, forceKN: 5 }], 0)
    expect(result.maxShearForceKN).toBeCloseTo(5, 1)
  })
})
```

---

### Aufgabe 2 — Bug: Stützen-Reaktionen aus echten Beam-Reactions

**Datei**: `packages/calc-engine/src/index.ts` (siehe Zeile ~277-284)

**Problem**: Aktuell wird `totalPermanentSTR_KN / numSupports` als uniforme Reaktion pro Stütze verwendet. Eine asymmetrische Last (z.B. LED-Wand am Rand) belastet aber die nahegelegene Stütze viel stärker.

**Folgen**:
- Knicknachweis ungenau (alle Stützen gleich → maximal beanspruchte Stütze nicht erkannt)
- Kippnachweis: Hebelarm-Mittelung verzerrt
- Ballastempfehlung gleichmäßig statt gezielt

**Fix**:
1. Im Beam-Loop: `calculateBeam` liefert bereits `reactionStartKN` und `reactionEndKN`. Diese auf die jeweilige Stütze aggregieren.
2. Multi-Support: Pro Segment Reaktion ermitteln, die innere Stütze bekommt die Summe der `reactionEnd` (vom linken Segment) und `reactionStart` (vom rechten Segment).
3. Stützen-Eigengewicht + Ballast + Fußsystem werden weiter direkt zur jeweiligen Stütze addiert (kein Splitting).

**Pseudo-Code**:

```typescript
const supportReactionsFromBeams = new Map<string, number>()  // [kN] characteristisch (bemessen)

for (const beam of input.beams) {
  const supportIds = beam.supportIds ?? [beam.startSupportId, beam.endSupportId]
  // pro Segment:
  for (let i = 0; i < supportIds.length - 1; i++) {
    const forces = calculateBeam(...)
    // STR-Bemessung: Reaktionen bereits enthalten γG (Eigengewicht) und γQ × Dyn (Lasten)
    add(supportReactionsFromBeams, supportIds[i], forces.reactionStartKN)
    add(supportReactionsFromBeams, supportIds[i + 1], forces.reactionEndKN)
  }
}

// Stützen-Eigengewicht + Ballast + Fuß werden direkt addiert
for (const support of input.supports) {
  const ownStr = (supportSelfWeight + ballast + footIfApplicable) * GAMMA_G
  supportReactionsFromBeams.set(support.id, (supportReactionsFromBeams.get(support.id) ?? 0) + ownStr)
}

// EQU-Variante analog mit γG_INF
```

**Achtung**: `getBeamSelfWeight` und Streckenlasten sind in `calculateBeam` über `selfWeightKNm` und `distributedSegments` schon mit Bemessungsfaktoren übergeben → Reaktionen sind bereits Bemessungswerte. NICHT nochmal mit γ multiplizieren.

**Tests** (ergänzen in `packages/calc-engine/tests/integration.test.ts`):

```typescript
it('Asymmetrische Last: nähere Stütze trägt mehr', () => {
  // 2 Stützen 6 m auseinander, 100 kg Last 1 m von Stütze A entfernt
  // Erwartung: A trägt ~83 %, B trägt ~17 %
  const result = calculate({
    // ...
    beams: [{
      // ...
      loads: [{ id: 'L1', label: 'Test', positionAlongBeam: 1, weight: 100 }],
    }],
  })
  const rA = result.supports[0]!.verticalReactionKN
  const rB = result.supports[1]!.verticalReactionKN
  expect(rA).toBeGreaterThan(rB * 3)  // grobes Verhältnis 5:1 bei 100 kg
})

it('Symmetrische Last: Stützen tragen gleich (Sanity-Check)', () => {
  // 2 Stützen 6 m, 100 kg in der Mitte
  const result = calculate({ /* ... */ })
  expect(result.supports[0]!.verticalReactionKN).toBeCloseTo(result.supports[1]!.verticalReactionKN, 1)
})
```

---

### Aufgabe 3 — Feature: Konfigurations-Vorlagen

**Ziel**: User wählt eine Vorlage aus 4-5 Templates, Formular wird vorausgefüllt, kleine Anpassungen reichen.

**Vorlagen** (alle Outdoor, WZ1, KatII, frictionConfig RUBBER_ON_CONCRETE):

1. **2-Stützen-Goalpost**
   - 2 Stützen Prolyte H30V, 5 m hoch, BASEPLATE Outrigger 1,2 m
   - 1 Traverse Prolyte H30V, 8 m Spannweite
   - 1 Windfläche BANNER_SOLID 6 m × 3 m mittig

2. **4-Stützen-Groundsupport (FOH)**
   - 4 Stützen Prolyte H40V, 6 m hoch, BASEPLATE Outrigger 1,5 m
   - Rechteck 6 m × 4 m
   - 4 Traversen (Rahmen) + 1 LED-Wand 6 m × 4 m

3. **Tower mit Konzertbestückung**
   - 1 Stütze (Tower) Prolyte H40V, 8 m, CONCRETE_BLOCK_1250 × 2
   - 1 Traverse 6 m mit Hängelasten 4 × 30 kg

4. **Indoor-Bühne**
   - 4 Stützen Prolyte H30V, 4 m, BASEPLATE
   - 2 Traversen
   - environment: 'INDOOR', doorsCanOpen: false

**Implementierung**:

1. Neue Datei `packages/web-app/lib/templates.ts`:
   ```typescript
   export interface Template {
     id: string
     label: string
     description: string
     buildInput: () => StructureInput
   }
   export const TEMPLATES: Template[] = [/* ... */]
   ```

2. Neue Komponente `packages/web-app/components/input/TemplateGallery.tsx`:
   - Grid mit 4 Karten (Icon, Titel, Beschreibung)
   - Klick → `onSelect(template.buildInput())`

3. In `app/calculator/page.tsx` oberhalb des Formulars einbinden:
   - „Mit Vorlage starten oder Felder direkt ausfüllen"
   - Button „Leere Konfiguration" + Vorlagen-Galerie

4. UUID-Generierung über `crypto.randomUUID()` für IDs (Service-Worker-sicher).

---

### Aufgabe 4 — Feature: Echte DIN-Symbole im Report

**Datei**: `packages/web-app/components/report/ReportDocument.tsx`

Suche & ersetze in formulaLine-Strings:

| ASCII | Symbol |
|---|---|
| `γG` als `gamma_G` → bleibt aber `γG` ist schon drin | OK |
| `eta` → `η` |
| `gamma` → `γ` |
| `mu` → `µ` |
| `sigma` → `σ` |
| `lambda` → `λ` |
| `^2` → `²` |
| `^3` → `³` |
| `<=` → `≤` |
| `>=` → `≥` |
| `rho` → `ρ` |
| `x` (mathematisches Mal) → `·` (Mittelpunkt) — vorsichtig, nicht überall |

Helvetica im React-PDF unterstützt diese Unicode-Zeichen, kein zusätzliches Font-Loading nötig. Falls Helvetica versagt: `<Font.register family="Inter" src="..." />` mit einem Open-Source-Font.

---

## Akzeptanzkriterien

- [ ] `pnpm test` in `packages/calc-engine` läuft grün (alle bestehenden + neue Tests)
- [ ] `pnpm typecheck` in `packages/web-app` läuft grün
- [ ] `pnpm build` in `packages/web-app` läuft grün
- [ ] Manueller Test: Test-Case aus `report_test_2026-05-14.pdf` reproduzieren — Ballast-Wert sollte sich nach Fix 1+2 leicht ändern (genauer, nicht symmetrisch verteilt)
- [ ] PDF zeigt griechische Symbole statt ASCII
- [ ] Vorlagen-Galerie sichtbar oberhalb des Calculator-Formulars

## Constraints

- **calc-engine** bleibt frei von UI-Logik (pure functions only)
- **Keine Breaking Changes** in `CalculationResult`, `StructureInput`, `Beam`, `Support` Schnittstellen — nur additive Änderungen (neue optionale Felder)
- **Keine** `any`-Types, keine Production-Logs (`console.log`)
- **Deutsch** in Kommentaren, **Englisch** in Bezeichnern
- **Normreferenzen** als Kommentar bei jeder Berechnungs-Formel
- Pre-commit-Hooks (eslint, typecheck) müssen durchlaufen
- Web-App nutzt **Next.js 16.2.6** — bei Unsicherheit `node_modules/next/dist/docs/` konsultieren (siehe `packages/web-app/AGENTS.md`)
- Umlaute (ä, ö, ü, ß) immer verwenden, niemals ASCII-Ersatz (ae, oe, ue, ss)

## Commit-Struktur

Bitte als getrennte Commits in der Reihenfolge:

1. `fix(calc-engine): maxShearForceKN-Verdopplung am rechten Auflager`
2. `fix(calc-engine): Stützenreaktionen aus echten Beam-Reactions statt uniformer Verteilung`
3. `test(calc-engine): Tests für Shear-Fix und Lastverteilungs-Fix`
4. `feat(web-app): Konfigurations-Vorlagen-Galerie`
5. `feat(report): Griechische DIN-Symbole statt ASCII-Ersatz`

Jeder Commit muss eigenständig grün sein (Tests + TypeScript).

## Definition of Done

Pull Request gegen `main` mit:
- Beschreibung „Was hat sich geändert und warum"
- Liste der bestandenen Tests
- Hinweise auf Nebenwirkungen (z.B. „Ballast-Werte können sich um ±5 % ändern weil Verteilung jetzt last-positionsabhängig ist")
- Screenshot der Vorlagen-Galerie + neuen Report-PDF-Seite
