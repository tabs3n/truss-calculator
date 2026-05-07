# Startprompt – Claude Code (calc-engine)

Lies zuerst vollständig:
- `CLAUDE.md` im Root des Repos
- `packages/calc-engine/src/types.ts`

Dann führe folgende Schritte aus:

---

## Schritt 1: Projekt-Setup

Erstelle `packages/calc-engine/` mit folgender Struktur:

```
packages/calc-engine/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── types.ts         ← bereits vorhanden, nicht anfassen
    ├── materials/
    ├── wind/
    ├── loads/
    ├── beam/
    ├── stability/
    ├── tipping/
    ├── sliding/
    └── index.ts         ← öffentliches API, zuletzt
```

`package.json` Dependencies: nur `typescript`, `vitest`. Keine UI-Pakete.

---

## Schritt 2: Materialdatenbank

Erstelle `src/materials/database.ts`.

Die Datenbank ist ein Record `TrussType → TrussProperties`.

```typescript
interface TrussProperties {
  label: string
  weightPerMeter: number   // kg/m
  crossSectionArea: number // cm²
  momentOfInertiaY: number // cm⁴
  momentOfInertiaZ: number // cm⁴
  eModulus: number         // kN/cm²
  // Bemessungswerte Tragfähigkeit
  bendingResistanceY: number   // My,Rd in kN·m
  bendingResistanceZ: number   // Mz,Rd in kN·m
  shearResistanceY: number     // Vy,Rd in kN
  shearResistanceZ: number     // Vz,Rd in kN
  normalForceResistance: number // Nch,Rd in kN (Gurtrohr)
  material: 'ALUMINIUM_6082_T6' | 'STEEL_S235' | 'STEEL_S355'
}
```

Werte aus CLAUDE.md übernehmen. Für noch nicht dokumentierte Typen: Platzhalter mit `// TODO: Herstellerdaten eintragen` Kommentar.

Schreibe einen Test der sicherstellt dass alle TrussType-Einträge vorhanden sind.

---

## Schritt 3: Windlastberechnung

Erstelle `src/wind/windLoad.ts`.

Implementiere folgende Funktionen exakt nach DIN EN 1991-1-4:

```typescript
function getRoughnessLength(category: TerrainCategory): { z0: number; zMin: number }
function getTerrainFactor(z0: number): number        // kr
function getRoughnessFactor(z: number, z0: number, zMin: number): number  // cr(z)
function getTurbulenceIntensity(z: number, z0: number): number            // Iv(z)
function getPeakVelocityPressure(                    // qp(z) in kN/m²
  windZone: WindZone,
  terrainCategory: TerrainCategory,
  heightAboveGround: number
): number
function calculateWindForce(                         // Fw in kN
  qp: number,
  width: number,
  height: number,
  cf?: number    // default 1.3
): number
```

Grundwindgeschwindigkeit vb je Windzone: 1→22.5, 2→25.0, 3→27.5, 4→30.0 m/s.
Luftdichte ρ = 1.25 kg/m³.

Schreibe Tests mit bekannten Handrechenwerten:
- Windzone 2, Geländekat. II, z = 5m → qp ≈ 0.65 kN/m²
- Windzone 3, Geländekat. III, z = 8m → berechne und dokumentiere im Test

---

## Schritt 4: Lastfälle & Kombinationen

Erstelle `src/loads/loadCombinations.ts`.

```typescript
const DYNAMIC_FACTOR = 1.20        // DGUV 215-313
const GAMMA_G = 1.35               // ständige Lasten
const GAMMA_Q = 1.50               // veränderliche Lasten

/** Gibt Bemessungslast zurück: Eigenlast × γG, Nutzlast × γQ × 1.20 */
function getDesignLoad(characteristicLoad: number, loadType: 'permanent' | 'variable'): number

/** Eigengewicht einer Traverse in kN für gegebene Länge */
function getBeamSelfWeight(trussType: TrussType, lengthM: number): number

/** 2,5%-Ersatzlast: horizontale Imperfektion auf Stützenkopfhöhe */
function getImperfectionLoad(totalVerticalLoadKN: number, numberOfSupports: number): number
```

---

## Schritt 5: Balkentheorie

Erstelle `src/beam/beamCalculation.ts`.

Berechne für einen Balken mit:
- Stützweite L (Abstand der Auflagerpunkte)
- Auskragung links / rechts (cantilever)
- n Einzellasten (Position + Wert)
- Eigengewicht als Streckenlast

Gesucht:
```typescript
interface BeamInternalForces {
  maxBendingMomentKNm: number     // maximales Biegemoment
  positionOfMaxMomentM: number    // Position des Maximums
  reactionStartKN: number         // Auflagerkraft linkes Lager
  reactionEndKN: number           // Auflagerkraft rechtes Lager
  maxShearForceKN: number
  maxDeflectionMm: number         // Durchbiegung (E×I aus Datenbank)
}

function calculateBeam(
  trussType: TrussType,
  spanM: number,
  cantileverStartM: number,
  cantileverEndM: number,
  pointLoads: { positionM: number; forceKN: number }[],
  distributedLoadKNm: number      // Eigengewicht
): BeamInternalForces
```

Verwende analytische Formeln (Superposition). Kein FEM.

Test: Einfeldträger 6m, Einzellast 10kN in Feldmitte → M = 15 kN·m, A = B = 5 kN.

---

## Schritt 6: Tragfähigkeitsnachweis Traverse

Erstelle `src/beam/utilizationCheck.ts`.

```typescript
interface UtilizationResult {
  bendingUtilization: number    // η = MEd / MRd
  shearUtilization: number      // η = VEd / VRd
  isOk: boolean
  failureReason?: string
}

function checkBeamUtilization(
  trussType: TrussType,
  internalForces: BeamInternalForces
): UtilizationResult
```

---

## Schritt 7: Knicknachweis Stütze

Erstelle `src/stability/bucklingCheck.ts`.

Euler-Knickung für Aluminium-Traverse als Druckstab:

```typescript
function checkBuckling(
  trussType: TrussType,
  heightM: number,           // Knicklänge = Stützenhöhe × β
  bucklingFactor: number,    // β, default 2.0 (Kragstütze)
  normalForceKN: number      // Druckkraft
): { utilization: number; isOk: boolean; criticalLoadKN: number }
```

Formel: Ncr = π² × E × I / (β × L)²

---

## Schritt 8: Kippsicherheit + Ballastermittlung

Erstelle `src/tipping/tippingCheck.ts`.

Dies ist das **Kernmodul**. Implementiere:

```typescript
function calculateTipping(
  supports: Support[],
  totalWindForceKN: number,
  windDirectionAngleDeg: number,   // 0° = +X, 90° = +Y, 180° = -X, 270° = -Y
  windApplicationHeightM: number,  // Angriffshöhe des Windkraftresultierenden
  supportVerticalReactions: Map<string, number>,  // kN je Stütze
): TippingDirectionResult
```

Logik:
1. Bestimme Kippachse: die zwei Stützen die windwärts am weitesten vorne liegen
2. Berechne kippendes Moment: Fw × Angriffshöhe
3. Berechne stabilisierendes Moment: Summe (Rz,i × Abstand zur Kippachse) für alle leeward Stützen
4. Bestimme Rz,min (kleinste Auflagerkraft)
5. Berechne erforderlichen Ballast: |Rz,min| × 2 / g

Berechne alle 4 Windrichtungen und gib den maßgebenden zurück.

---

## Schritt 9: Gleitnachweis

Erstelle `src/sliding/slidingCheck.ts`.

```typescript
function checkSliding(
  totalHorizontalForceKN: number,
  totalVerticalForceKN: number,
  frictionCoefficient: number
): SlidingResult
```

Formel: Ballast_gleiten = (Fh / μ) - Fv (negativ → kein Ballast nötig)

---

## Schritt 10: Öffentliches API

Erstelle `src/index.ts` – exportiert nur eine Hauptfunktion:

```typescript
export function calculate(input: StructureInput): CalculationResult
```

Diese Funktion orchestriert alle Module in der richtigen Reihenfolge:
1. Eigengewichte aus Datenbank
2. Windlast (alle 4 Richtungen)
3. Lastfälle aufstellen
4. Balkenberechnung pro Traverse
5. Tragfähigkeitsnachweis Traversen
6. Knicknachweis Stützen
7. Auflagerkräfte ermitteln
8. Kippsicherheit alle Richtungen
9. Gleitnachweis
10. Ergebnis zusammenstellen

Exportiere außerdem alle Types aus `types.ts` re-export.

---

## Wichtige Hinweise

- Alle Zwischenergebnisse in SI-Einheiten (kN, m, cm²) – keine impliziten Konversionen
- Kommentare in Deutsch, Code (Variablennamen, Funktionen) in Englisch
- Bei jeder Formel: Kommentar mit Normreferenz, z.B. `// DIN EN 1991-1-4 Gl. 4.5`
- Kein `any` in TypeScript
- `console.log` nur in Tests, nie im Produktionscode
