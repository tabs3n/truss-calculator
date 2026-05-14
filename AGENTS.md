# Truss Calculator – AGENTS.md

## Projektübersicht

Standsicherheits-Berechnungstool für bodengestützte Traversensysteme (Groundsupports, Tower) im
Veranstaltungsbereich. Primäre Ausgabe: Kippsicherheitsnachweis + erforderlicher Ballast für
Außeneinsatz. Benutzer: Fachkraft für Veranstaltungstechnik (Cologne Hunters Licht & Ton Service GmbH).

## Repository-Struktur

```
truss-calculator/
├── AGENTS.md                        ← diese Datei
├── packages/
│   ├── calc-engine/                 ← Codex Verantwortung
│   │   ├── src/
│   │   │   ├── materials/           # Traversendatenbank
│   │   │   ├── wind/                # DIN EN 1991-1-4 Windlast
│   │   │   ├── loads/               # Lastfälle + Kombinationen
│   │   │   ├── beam/                # Balkentheorie
│   │   │   ├── stability/           # Euler-Knicken
│   │   │   ├── tipping/             # Kippsicherheit + Ballast
│   │   │   ├── sliding/             # Gleitnachweis
│   │   │   └── index.ts             # Öffentliches API
│   │   └── tests/                   # Vitest Unit-Tests
│   │
│   └── web-app/                     ← Codex / Cursor Verantwortung
│       ← importiert nur aus calc-engine/src/index.ts
│
└── vw-export/                       ← Python-Script für VW-Export
    └── export_truss.py
```

## Codex Verantwortung

Codex schreibt und pflegt **ausschließlich** `packages/calc-engine/`.
Keine UI-Logik, keine React-Komponenten, keine CSS.
Alle Funktionen sind **pure functions** – kein State, keine Side Effects.
Jede Berechnungsfunktion hat einen zugehörigen Unit-Test.

## Normen und Grundlagen

| Norm | Anwendung |
|------|-----------|
| DIN EN 1991-1-4 | Windlasten |
| DIN EN 1993-1 (EC3) | Stahlbau-Nachweise |
| DIN EN 1999-1-1 (EC9) | Aluminiumbau-Nachweise |
| DIN EN 17879 | Event-Strukturen Sicherheit |
| DIN EN 13814 | Reibbeiwerte, Bodenpressung |
| DGUV Information 215-313 | +20% Dynamikzuschlag auf alle Lasten |

## Teilsicherheitsbeiwerte (DIN EN 1990)

```
γG = 1.35   // ständige Lasten (Eigengewicht)
γQ = 1.50   // veränderliche Lasten (Wind, Nutzlast)
γM1 = 1.10  // Aluminium Querschnittstragfähigkeit
γM2 = 1.25  // Aluminium Stabilitätsnachweis
```

**Dynamikzuschlag:** Alle Nutzlasten × 1.20 (DGUV 215-313)

## Traversendatenbank (verifizierte Werte aus Systemstatik)

### Prolyte H40V
```
gewicht:     6.9 kg/m
A:           16.96 cm²
Iy = Iz:     4917.1 cm⁴
E:           7000.0 kN/cm²
My_Rd:       34.05 kN·m
Mz_Rd:       34.05 kN·m
Vy_Rd:       18.94 kN
Vz_Rd:       18.94 kN
Nch_Rd:      50.22 kN  (Gurtrohr)
```

### Prolyte H30D (Referenzwerte)
```
gewicht:     5.0 kg/m
A:           12.72 cm²
Iy:          1395.32 cm⁴
Iz:          1849.29 cm⁴
E:           7000.0 kN/cm²
My_Rd:       10.39 kN·m
Mz_Rd:       12.0 kN·m
Vy_Rd:       7.36 kN
Vz_Rd:       12.76 kN
```

### Rohr Ø48.3×3.2 (Stahl S235) – Standardrohr/Pipe
```
gewicht:     3.56 kg/m
A:           4.53 cm²
I:           10.78 cm⁴
E:           21000.0 kN/cm²
```

> Weitere Traversentypen können ergänzt werden. Jeder Eintrag
> muss Quelle/Referenz enthalten (Systemstatik oder Herstellerdatenblatt).

## Windlastberechnung (DIN EN 1991-1-4)

### Grundwindgeschwindigkeit vb [m/s] nach Windzone

| Zone | vb |
|------|----|
| 1    | 22.5 |
| 2    | 25.0 |
| 3    | 27.5 |
| 4    | 30.0 |

### Geländekategorie – Rauigkeitslänge z0 und zmin

| Kategorie | z0 [m] | zmin [m] |
|-----------|--------|----------|
| I         | 0.01   | 1        |
| II        | 0.05   | 2        |
| III       | 0.30   | 5        |
| IV        | 1.00   | 10       |

### Berechnungsweg

```
cr(z) = kr × ln(z / z0)          // Rauigkeitsbeiwert
kr = 0.19 × (z0 / 0.05)^0.07    // Geländefaktor

vm(z) = cr(z) × vb               // mittlere Windgeschwindigkeit

Iv(z) = σv / vm(z) = 1 / ln(z / z0)   // Turbulenzintensität

qp(z) = (1 + 7×Iv(z)) × 0.5 × ρ × vm(z)²
// ρ = 1.25 kg/m³ (Luftdichte)

Fw = cf × qp(z) × Aref           // Windkraft
// cf = 1.3 (konservativ für Traverse/Equipment)
// Aref = Breite × Höhe der Angriffsfläche
```

## Kippsicherheitsnachweis

### Lastfälle
1. Wind in +X-Richtung
2. Wind in +Y-Richtung
3. Wind in -X-Richtung
4. Wind in -Y-Richtung
5. 2,5% der Gesamtvertikallast als Horizontallast (alle 4 Richtungen)

Maßgebend ist der **ungünstigste** Lastfall (kleinste Auflagerkraft).

### Kippachse (multi-Stützen-Systeme)
Die Kippachse verläuft durch die zwei **windseitig vordersten** Stützen.
Alle anderen Stützen liefern stabilisierende Momente.

### Nachweis
```
Rz,min = minimale Auflagerkraft (negativster Wert = abhebend) [kN]
FBallast = Ballastgewicht × g [kN]

η = |Rz,min| / (FBallast / 2) ≤ 1.0  ✓

// Division durch 2: Ballast wirkt auf beide Stützen der Kippachse,
// pro Stütze steht also nur FBallast/2 zur Verfügung.
```

### Gleitnachweis
```
res.Rh = √(Rx² + Ry²)            // resultierende Horizontalkraft
Ballast_gleiten = res.Rh / μ - Rz  // erforderlicher Zusatzballast
// μ = 0.3 (konservativ, DIN EN 13814)
// negativer Wert → kein Zusatzballast erforderlich
```

## Maßgebender Ballast

```
Ballast_erf = max(Ballast_kippen, Ballast_gleiten, 0)
```

Ausgabe als **Gesamtgewicht in kg** – ohne Angabe des Mediums.

## Vereinfachungen (dokumentiert und konservativ)

- Lastverteilung bei statisch unbestimmten Systemen: **gleichmäßige Verteilung** auf alle Stützen
- Winddruckbeiwert cf = 1.3 (konservativ, kein Abminderungsfaktor für Durchlässigkeit)
- Knicknachweis Traverse: über globale Momententragfähigkeit (nicht FEM)
- Eigengewicht Verbindungselemente: pauschal +5% auf Traverseneigengewicht

## Fehlerbehandlung

Jede Berechnungsfunktion wirft einen typisierten Fehler wenn:
- Eingaben außerhalb sinnvoller Grenzen (z.B. Höhe > 20m, Windzone < 1)
- Ausnutzung η > 1.0 → Result enthält `isOk: false` + Fehlermeldung
- Unbekannter Traversentyp in Datenbank

## Testing

- **Vitest** für alle Unit-Tests
- Jede Rechenformel hat mindestens einen Test mit Handrechnung als Referenz
- Integrationtest: Gesamtberechnung mit bekannten Werten aus der Area Four Statik (Projekt 260057) als Referenz

## Offene Punkte / TODO für Codex

- [ ] Windzonenkarte Deutschland: PLZ → Windzone Lookup (optional, später)
- [ ] Rohrdurchmesser-Parameter für freie Rohrkonfiguration
- [ ] Knotengewichte (Conical Couplers, Sleeveblocks) als optionaler Parameter
