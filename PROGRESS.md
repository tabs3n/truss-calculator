# Session 3 — Progress Tracker

> **Letzter Stand**: 2026-05-14
> **Beide Worker** aktualisieren ihren Block beim Abschluss eines Items mit Commit-Hash + kurzer Notiz.
> Bei Token-Aus: Datei wird gepusht → Resume zeigt sofort wo's weitergeht.

---

## 📋 Claude (UI / Hooks / Renderer)

| # | Item | Status | Commit | Notiz |
|---|---|---|---|---|
| 1 | Live-Berechnung (debounced 300 ms auto-recalc) | ✅ Fertig | `9f5e81b` | Toggle in Sidebar, Pref in localStorage |
| 5 | Print-Stylesheet für Calculator-Seite | ⬜ Offen | — | `@media print` in globals.css |
| 8 | Mobile-friendly Layout (Tablet/Phone) | ⬜ Offen | — | Sidebar als Bottom-Sheet auf <lg |
| 18 | Versionierung (letzte 10 Berechnungen) | ✅ Fertig | `9f5e81b` | CalculationHistory.tsx in Sidebar |
| 21 | 3D-Darstellung mit Three.js | ⬜ Offen | — | Neue `ThreeDView.tsx`, optional als Sub-Tab |
| 22 | Animation Wind-Richtung im Grundriss | ⬜ Offen | — | StructureRenderer: Hover-Effekt |
| 23 | Drag & Drop für Stützenpositionen | ⬜ Offen | — | StructureRenderer: SVG-Pointer-Events |

**Datei-Bereiche** (Claude touched only):
- `packages/web-app/hooks/useCalculation.ts`
- `packages/web-app/app/globals.css`
- `packages/web-app/app/calculator/page.tsx` (Mobile-Layout)
- `packages/web-app/components/rendering/StructureRenderer.tsx`
- `packages/web-app/components/rendering/ThreeDView.tsx` (NEU)
- `packages/web-app/components/ui/CalculationHistory.tsx` (NEU)

---

## 📋 Codex (Calc-Engine / Report / Forms)

| # | Item | Status | Commit | Notiz |
|---|---|---|---|---|
| 2 | Tooltips mit Norm-Referenzen | 🔄 In Arbeit | — | Tooltip-Primitive + Normtexte in Formularen begonnen |
| 6 | Schnittkraft-Diagramme im Report | ⬜ Offen | — | M-, V-, Biegelinien-Verlauf je Beam |
| 7 | Was-wäre-wenn-Vergleich im Report | ⬜ Offen | — | `calculateVariants()` + neue Report-Seite |
| 9 | Snow-Load UI Integration | ⬜ Offen | — | StructureInput.snowConfig + Engine + ProjectForm |
| 10 | Eingabe-Validierung mit Echo | ⬜ Offen | — | Zentrale Validator-Funktionen + UI-Anzeige |
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

- _(Hier können Beide reinschreiben wenn was zwischen Items aufgefallen ist)_

---

## 🎬 Resume-Anleitung

Wenn morgen weitergemacht wird:
1. Diese Datei lesen → was steht auf ⬜ Offen?
2. `git log --oneline -20` → letzte Commits
3. NEXT_STEPS.md → großer Backlog falls Session-3-Items fertig
4. Codex weiter mit `PROMPT_CODEX_SESSION3.md`
