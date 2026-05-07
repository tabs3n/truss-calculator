# Startprompt – Codex / Cursor (web-app parallel)

Lies zuerst:
- `CLAUDE.md` im Root
- `packages/calc-engine/src/types.ts`
- `PROMPT_CODEX.md`

Die calc-engine wird parallel von einem anderen Tool gebaut und ist noch nicht fertig.
Baue daher alles was NICHT von `calculate()` abhängt zuerst.
Wo `calculate()` aufgerufen werden würde, setze einen Platzhalter ein.

---

## Phase 1: Setup (jetzt sofort)

```bash
cd packages
npx create-next-app@latest web-app --typescript --tailwind --app --no-src-dir --yes
cd web-app
npx shadcn-ui@latest init --yes
npm install @react-pdf/renderer
```

Ergänze im Root `package.json`:
```json
{
  "name": "truss-calculator",
  "private": true,
  "workspaces": ["packages/*"]
}
```

---

## Phase 2: Ordnerstruktur anlegen

Erstelle alle Ordner und leere Index-Dateien gemäß PROMPT_CODEX.md Schritt 2.

---

## Phase 3: Types importieren

Erstelle `lib/types-bridge.ts`:

```typescript
// Temporärer Re-Export bis calc-engine fertig ist
// Sobald calc-engine gebaut ist: diesen Import ersetzen durch:
// export * from '../../calc-engine/src/index'
export type {
  StructureInput,
  CalculationResult,
  Support,
  Beam,
  HangingLoad,
  WindSurface,
  TrussType,
  WindZone,
  TerrainCategory,
  FootType,
  VWExportData
} from '../../calc-engine/src/types'
```

---

## Phase 4: Default-Input und Konstanten

Erstelle `lib/defaultInput.ts` – ein leeres aber valides `StructureInput`:

```typescript
import { StructureInput } from './types-bridge'

export const defaultInput: StructureInput = {
  projectName: '',
  eventName: '',
  location: '',
  date: new Date().toISOString().split('T')[0],
  preparedBy: '',
  windZone: 2,
  terrainCategory: 'II',
  supports: [],
  beams: [],
  frictionCoefficient: 0.3
}
```

Erstelle `lib/constants.ts`:

```typescript
export const COMPANY = {
  name: 'Cologne Hunters Licht & Ton Service GmbH',
  address: 'Bonner Wall 31, 50677 Köln',
}

export const DISCLAIMER =
  'Dieses Dokument ist eine Planungsgrundlage und kein geprüfter ' +
  'Standsicherheitsnachweis nach §§ der jeweiligen Landesbauordnung. ' +
  'Die Verantwortung für die korrekte Ausführung liegt beim Betreiber.'

export const TRUSS_LABELS: Record<string, string> = {
  PROLYTE_H30V: 'Prolyte H30V',
  PROLYTE_H30D: 'Prolyte H30D',
  PROLYTE_H40V: 'Prolyte H40V',
  PIPE_48_3_STEEL: 'Rohr Ø48.3 Stahl',
  PIPE_50_3_ALU: 'Rohr Ø50 Alu',
}

export const FOOT_LABELS: Record<string, string> = {
  BASEPLATE: 'Bodenplatte',
  CONCRETE_BLOCK_1250: 'Betonblock 1250 kg',
  TRUSS_PLATE_30x30: 'Traversenplatte 30×30',
}
```

---

## Phase 5: State Hook (mit Platzhalter für calculate)

Erstelle `hooks/useCalculation.ts`:

```typescript
'use client'
import { useState, useCallback } from 'react'
import { StructureInput, CalculationResult } from '../lib/types-bridge'
import { defaultInput } from '../lib/defaultInput'

// Platzhalter bis calc-engine fertig ist
function calculate(_input: StructureInput): CalculationResult {
  throw new Error('calc-engine noch nicht verbunden')
}

export function useCalculation() {
  const [input, setInput] = useState<StructureInput>(defaultInput)
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runCalculation = useCallback(() => {
    setIsCalculating(true)
    setError(null)
    try {
      const res = calculate(input)
      setResult(res)
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

## Phase 6: Alle Input-Formulare bauen

Baue vollständig (kein Platzhalter nötig – diese hängen nicht von calc-engine ab):

- `components/input/ProjectForm.tsx`
- `components/input/SupportList.tsx` + `SupportForm.tsx`
- `components/input/BeamList.tsx` + `BeamForm.tsx`
- `components/input/LoadForm.tsx`
- `components/input/WindSurfaceForm.tsx`

Details gemäß PROMPT_CODEX.md Schritt 4.

---

## Phase 7: SVG-Renderer bauen

Baue vollständig – braucht nur `input`, kein `result`:

- `components/rendering/StructureRenderer.tsx` (Grundriss)
- `components/rendering/ElevationRenderer.tsx` (Elevation)

Zeige Stützen als Kreise, Traversen als Linien.
Solange kein `result` vorhanden: alle Stützen grau.

---

## Phase 8: Ergebnis-Platzhalter

Erstelle `components/results/ResultSummary.tsx` mit Platzhalterinhalt:

```tsx
export function ResultSummary({ result }: { result: CalculationResult | null }) {
  if (!result) return (
    <div className="rounded-lg border p-6 text-center text-muted-foreground">
      Eingaben vervollständigen und Berechnung starten
    </div>
  )
  // TODO: echte Ergebnisanzeige sobald calc-engine verbunden
  return <div>Ergebnis: {result.overallOk ? '✅ OK' : '❌ NICHT OK'}</div>
}
```

---

## Phase 9: Hauptseite zusammenbauen

Erstelle `app/calculator/page.tsx` – verbindet alle Komponenten:

```
Layout: 2 Spalten
Links:  Input-Formulare + SVG-Renderer
Rechts: Ergebnis-Platzhalter + "Berechnen"-Button
```

---

## Sobald calc-engine fertig ist (Phase 10):

Ersetze in `hooks/useCalculation.ts` den Platzhalter:

```typescript
// ALT:
function calculate(_input: StructureInput): CalculationResult { ... }

// NEU:
import { calculate } from '../../calc-engine/src/index'
```

Dann baue die vollständigen Ergebniskomponenten:
- `ResultSummary`, `BallastTable`, `BeamResults`, `TippingResults`
- PDF-Report (`ReportDocument.tsx`, `ReportButton.tsx`)
- VW JSON-Import (`lib/importVW.ts`)
