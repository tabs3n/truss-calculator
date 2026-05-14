"use client"

import { useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { ArrowLeft, FileUp } from "lucide-react"

import { ProjectForm } from "@/components/input/ProjectForm"
import { BeamList } from "@/components/input/BeamList"
import { ConfigImportExport } from "@/components/input/ConfigImportExport"
import { SupportList } from "@/components/input/SupportList"
import { TemplateGallery } from "@/components/input/TemplateGallery"
import { TrussGateWizard } from "@/components/input/TrussGateWizard"
import { ReportButton } from "@/components/report/ReportButton"
import { ElevationRenderer } from "@/components/rendering/ElevationRenderer"
import { Structure3DView } from "@/components/rendering/Structure3DView"
import { StructureRenderer } from "@/components/rendering/StructureRenderer"
import { BallastTable } from "@/components/results/BallastTable"
import { BeamResults } from "@/components/results/BeamResults"
import { Recommendations } from "@/components/results/Recommendations"
import { ResultSummary } from "@/components/results/ResultSummary"
import { TippingResults } from "@/components/results/TippingResults"
import { Button } from "@/components/ui/button"
import { CalculationHistory } from "@/components/ui/CalculationHistory"
import { useCalculation } from "@/hooks/useCalculation"
import { importFromVW } from "@/lib/importVW"
import { createEmptyInput } from "@/lib/templates"
import type { Beam, StructureInput, Support, VWExportData } from "@/lib/types-bridge"

export default function CalculatorPage() {
  const {
    input,
    setInput,
    result,
    isCalculating,
    error,
    runCalculation,
    hasRestoredDraft,
    dismissRestoredDraft,
    resetToDefault,
    liveCalculation,
    setLiveCalculation,
    history,
    restoreFromHistory,
    deleteHistoryEntry,
    clearHistory,
  } = useCalculation()
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const updateInput = (next: StructureInput) => {
    setInput(next)
  }

  const applyTemplate = (next: StructureInput) => {
    setImportError(null)
    setImportMessage(null)
    setInput(next)
  }

  const updateSupports = (supports: Support[]) => {
    const supportIds = new Set(supports.map((support) => support.id))

    setInput((current) => ({
      ...current,
      supports,
      beams: current.beams.filter(
        (beam) => supportIds.has(beam.startSupportId) && supportIds.has(beam.endSupportId),
      ),
    }))
  }

  const updateBeams = (beams: Beam[]) => {
    setInput((current) => ({ ...current, beams }))
  }

  const applyTrussGateWizard = (next: Pick<StructureInput, "supports" | "beams">) => {
    setInput((current) => ({
      ...current,
      supports: next.supports,
      beams: next.beams,
    }))
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportError(null)
    setImportMessage(null)

    try {
      const parsed = JSON.parse(await file.text()) as VWExportData
      const nextInput = importFromVW(parsed)
      setInput(nextInput)
      setImportMessage(
        "VW-Import erfolgreich. Nicht erkannte Typen wurden gegebenenfalls konservativ ersetzt.",
      )
    } catch (importErr) {
      setImportError(importErr instanceof Error ? importErr.message : "JSON-Import fehlgeschlagen.")
    } finally {
      event.target.value = ""
    }
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-6 sm:px-6 lg:px-8 xl:pb-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <section className="rounded-[1.75rem] border border-border/70 bg-card/90 px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Zurück
              </Link>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Planungsrechner
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Konfiguration erfassen, Kipp-, Gleit- und Knicknachweis nach DIN EN rechnen
                und als signaturfertigen PDF-Bericht exportieren.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-border bg-background/80 p-3 text-xs text-muted-foreground sm:gap-4 sm:p-4 sm:text-sm">
              <div>
                <p className="text-lg font-semibold text-foreground sm:text-base">{input.supports.length}</p>
                <p>Stützen</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground sm:text-base">{input.beams.length}</p>
                <p>Traversen</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground sm:text-base">
                  {input.beams.reduce((sum, beam) => sum + beam.loads.length, 0)}
                </p>
                <p>Hängelasten</p>
              </div>
            </div>
          </div>
        </section>

        {hasRestoredDraft ? (
          <section className="rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Letzte Konfiguration aus dem Browser wiederhergestellt. Weiterarbeiten oder neu starten?
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={dismissRestoredDraft}>
                Weiterarbeiten
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={resetToDefault}>
                Neu starten
              </Button>
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-6">
            <div data-print="hide">
              <TemplateGallery
                onSelect={applyTemplate}
                onEmpty={() => applyTemplate(createEmptyInput())}
              />
            </div>
            <ProjectForm input={input} onChange={updateInput} />
            <div data-print="hide">
              <TrussGateWizard
                hasExistingStructure={input.supports.length > 0 || input.beams.length > 0}
                onApply={applyTrussGateWizard}
              />
            </div>
            <SupportList supports={input.supports} onChange={updateSupports} />
            <BeamList beams={input.beams} supports={input.supports} onChange={updateBeams} />
            <div className="grid gap-6 xl:grid-cols-2">
              <StructureRenderer input={input} result={result} onSupportsChange={updateSupports} />
              <ElevationRenderer input={input} result={result} />
            </div>
            <Structure3DView input={input} result={result} />
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <section data-print="hide" className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Berechnung</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {liveCalculation
                      ? "Live-Modus: Berechnung läuft bei jeder Eingabe automatisch."
                      : "Manueller Modus: Berechnung mit „Berechnen" auslösen."}
                  </p>
                </div>
                <label
                  className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground"
                  title="Auto-Berechnung bei jeder Änderung (300 ms debounced)"
                >
                  <span>Live</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={liveCalculation}
                    onChange={(event) => setLiveCalculation(event.target.checked)}
                  />
                </label>
              </div>
              <div className="mt-5 space-y-3">
                <Button
                  type="button"
                  className="h-11 w-full text-sm font-semibold"
                  onClick={runCalculation}
                  disabled={isCalculating}
                >
                  {isCalculating
                    ? "Berechne..."
                    : liveCalculation
                      ? "Berechnen & speichern"
                      : "Berechnen"}
                </Button>
                <ReportButton result={result} />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full text-sm font-semibold"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp />
                  VW JSON importieren
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleImport}
                />
              </div>
              {importMessage ? (
                <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-700">
                  {importMessage}
                </div>
              ) : null}
              {importError ? (
                <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  {importError}
                </div>
              ) : null}
              {error ? (
                <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-border bg-background/80 p-4 text-sm text-muted-foreground">
                  Neue Eingaben setzen das letzte Ergebnis zurück. Nach Änderungen die Berechnung
                  erneut starten, damit Report und Nachweise konsistent bleiben.
                </div>
              )}
            </section>

            <div data-print="hide">
              <ConfigImportExport input={input} onImport={applyTemplate} variant="sidebar" />
            </div>

            <div data-print="hide">
              <CalculationHistory
                history={history}
                onRestore={restoreFromHistory}
                onDelete={deleteHistoryEntry}
                onClear={clearHistory}
              />
            </div>

            <ResultSummary result={result} />
            <Recommendations result={result} />
            <BallastTable result={result} />
            <BeamResults result={result} />
            <TippingResults result={result} />
          </aside>
        </div>
      </div>

      {/* Mobile-FAB: zeigt Berechnen-Action + Status nur auf Smartphone/Tablet */}
      {!liveCalculation ? (
        <div
          data-print="hide"
          className="fixed bottom-4 left-4 right-4 z-40 flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur xl:hidden"
        >
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs text-muted-foreground">
              {result
                ? result.overallOk
                  ? "✓ Standsicher"
                  : `⚠ Nicht standsicher · ${(result.requiredBallastTotalKg / 1000).toFixed(1)} t Ballast`
                : "Noch keine Berechnung"}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={runCalculation}
            disabled={isCalculating}
            className="h-10 px-4 text-xs font-semibold"
          >
            {isCalculating ? "..." : "Berechnen"}
          </Button>
        </div>
      ) : result ? (
        <div
          data-print="hide"
          className="fixed bottom-4 left-4 right-4 z-40 flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur xl:hidden"
        >
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              result.overallOk ? "bg-emerald-500" : "bg-destructive"
            } animate-pulse`}
          />
          <p className="flex-1 truncate text-xs">
            {result.overallOk ? "Standsicher · " : "Nicht standsicher · "}
            <span className="font-semibold">
              {(result.requiredBallastTotalKg / 1000).toFixed(1)} t Ballast
            </span>
          </p>
        </div>
      ) : null}
    </main>
  )
}
