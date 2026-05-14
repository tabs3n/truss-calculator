# Session 3 — Progress Tracker

> **Letzter Stand**: 2026-05-14
> **Beide Worker** aktualisieren ihren Block beim Abschluss eines Items mit Commit-Hash + kurzer Notiz.
> Bei Token-Aus: Datei wird gepusht → Resume zeigt sofort wo's weitergeht.

---

## 📋 Claude (UI / Hooks / Renderer)

| # | Item | Status | Commit | Notiz |
|---|---|---|---|---|
| 1 | Live-Berechnung (debounced 300 ms auto-recalc) | ✅ Fertig | `9f5e81b` | Toggle in Sidebar, Pref in localStorage |
| 5 | Print-Stylesheet für Calculator-Seite | ✅ Fertig | `025563c` | globals.css + data-print=hide auf Sidebar |
| 8 | Mobile-friendly Layout (Tablet/Phone) | ✅ Fertig | `98666ee` | kompakte Hero-Stats + Bottom-FAB unter xl |
| 18 | Versionierung (letzte 10 Berechnungen) | ✅ Fertig | `9f5e81b` | CalculationHistory.tsx in Sidebar |
| 21 | 3D-Darstellung interaktiv | ✅ Fertig | `1c796a7` | `Structure3DView.tsx` — Drag-Rotate, dependency-frei (kein Three.js, manual SVG-Projection + Painter's Algorithm) |
| 22 | Animation Wind-Richtung im Grundriss | ✅ Fertig | `af2a7b0` | Hover-Animation + Tooltip im SVG |
| 23 | Drag & Drop für Stützenpositionen | ✅ Fertig | `af2a7b0` | Pointer-Events + Snap 0,1 m + Live-Koordinaten |

**Datei-Bereiche** (Claude touched only):
- `packages/web-app/hooks/useCalculation.ts`
- `packages/web-app/app/globals.css`
- `packages/web-app/app/calculator/page.tsx` (Mobile-Layout)
- `packages/web-app/components/rendering/StructureRenderer.tsx`
- `packages/web-app/components/rendering/Structure3DView.tsx` (NEU)
- `packages/web-app/components/ui/CalculationHistory.tsx` (NEU)

---

## 📋 Codex (Calc-Engine / Report / Forms)

| # | Item | Status | Commit | Notiz |
|---|---|---|---|---|
| 2 | Tooltips mit Norm-Referenzen | 🔄 In Arbeit | — | Tooltip-Primitive + Normtexte in Formularen begonnen |
| 6 | Schnittkraft-Diagramme im Report | 🔄 In Arbeit | — | Beam-Samples in Engine + Report-Diagrammseite begonnen |
| 7 | Was-wäre-wenn-Vergleich im Report | ⬜ Offen | — | `calculateVariants()` + neue Report-Seite |
| 9 | Snow-Load UI Integration | 🔄 In Arbeit | — | Typen + Engine-Lastansatz + ProjectForm + Report begonnen |
| 10 | Eingabe-Validierung mit Echo | 🔄 In Arbeit | — | `validation.ts` + erste Feld-Echos in Forms |
| 15 | Materialdatenbank vervollständigen | ⬜ Offen | — | TRUSS_DATABASE mit verifizierten Werten + Quellen |

**Datei-Bereiche** (Codex touched only):
- `packages/calc-engine/src/index.ts` (variants API + snow load)
- `packages/calc-engine/src/types.ts` (StructureInput + BeamResult Extensions)
- `packages/calc-engine/src/beam/beamCalculation.ts` (momentSamples in Result)
- `packages/calc-engine/src/materials/database.ts` (verifizierte Daten)
- `packages/web-app/components/input/ProjectForm.tsx` (Snow + Validation + Tooltips)
- `packages/web-app/components/input/SupportForm.tsx` (Validation + Tooltips)
- `packages/web-app/components/input/BeamForm.tsx` (Validation + Tooltips)
- `packages/web-app/components/report/ReportDocument.tsx` (Diagramme + Variants)
- `packages/web-app/components/report/BeamDiagrams.tsx` (NEU)
- `packages/web-app/components/report/VariantsComparison.tsx` (NEU)
- `packages/web-app/components/ui/Tooltip.tsx` (NEU)
- `packages/web-app/lib/tooltip-texts.ts` (NEU)
- `packages/calc-engine/tests/*.test.ts` (Tests für variants + validation + snow)

---

## ⚠️ Konflikt-Vermeidung

**Niemand fasst** die anderen Dateien an außer den eigenen Bereichen.

**Wenn Datei in BEIDEN Listen erscheint** (sollte nicht passieren laut Plan):
1. Erst Reden / Sync
2. Sonst: kleinerer Beitrag wartet bis größerer committed ist

---

## 🏁 Abschluss-Check pro Item

Bevor ein Item ✅ markiert wird:
- [ ] Code committed mit Hash
- [ ] Tests (wenn engine) bzw. manueller UI-Check
- [ ] Notiz: was wurde gemacht, wo evtl. Stolpersteine
- [ ] Andere Worker-Liste angeschaut: hat sich was geändert was integriert werden muss?

---

## 📝 Notizen / Open Issues (frei für Beide)

**Claude — alle 7 Items erledigt** ✅
- Commits: `9f5e81b`, `025563c`, `af2a7b0`, `98666ee`, `1c796a7`
- `useCalculation` hat jetzt `liveCalculation`, `history`, `restoreFromHistory`,
  `deleteHistoryEntry`, `clearHistory`, `setLiveCalculation` zusätzlich.
- Wenn Codex Forms anfasst: bitte beachten dass `setInput` jetzt
  bei Live-Modus das Result NICHT mehr invalidiert.
- Drag&Drop in StructureRenderer: prop `onSupportsChange` ist optional —
  ohne diese ist der Renderer read-only.
- Mobile-FAB ist bei Live-Modus statusanzeigend, bei Manuell-Modus
  hat es einen Berechnen-Button.

---

## 🎬 Resume-Anleitung

Wenn morgen weitergemacht wird:
1. Diese Datei lesen → was steht auf ⬜ Offen?
2. `git log --oneline -20` → letzte Commits
3. NEXT_STEPS.md → großer Backlog falls Session-3-Items fertig
4. Codex weiter mit `PROMPT_CODEX_SESSION3.md`
