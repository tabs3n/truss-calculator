"use client"

import { useRef, useState, type ChangeEvent } from "react"
import { FileUp } from "lucide-react"

import { ProjectForm } from "@/components/input/ProjectForm"
import { BeamList } from "@/components/input/BeamList"
import { SupportList } from "@/components/input/SupportList"
import { TrussGateWizard } from "@/components/input/TrussGateWizard"
import { ReportButton } from "@/components/report/ReportButton"
import { ElevationRenderer } from "@/components/rendering/ElevationRenderer"
import { StructureRenderer } from "@/components/rendering/StructureRenderer"
import { BallastTable } from "@/components/results/BallastTable"
import { BeamResults } from "@/components/results/BeamResults"
import { ResultSummary } from "@/components/results/ResultSummary"
import { TippingResults } from "@/components/results/TippingResults"
import { Button } from "@/components/ui/button"
import { useCalculation } from "@/hooks/useCalculation"
import { importFromVW } from "@/lib/importVW"
import type { Beam, StructureInput, Support, VWExportData } from "@/lib/types-bridge"

export default function CalculatorPage() {
  const { input, setInput, result, isCalculating, error, runCalculation } = useCalculation()
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const updateInput = (next: StructureInput) => {
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
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <section className="rounded-[1.75rem] border border-border/70 bg-card/90 px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Arbeitsoberfläche
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Truss Calculator
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Eingaben, Visualisierung, Ergebnisauswertung und PDF-Report greifen jetzt direkt
                auf die angebundene `calc-engine` zu.
              </p>
            </div>

            <div className="grid gap-3 rounded-2xl border border-border bg-background/80 p-4 text-sm text-muted-foreground sm:grid-cols-3">
              <div>
                <p className="font-semibold text-foreground">{input.supports.length}</p>
                <p>Stützen</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">{input.beams.length}</p>
                <p>Traversen</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {input.beams.reduce((sum, beam) => sum + beam.loads.length, 0)}
                </p>
                <p>Hängelasten</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-6">
            <ProjectForm input={input} onChange={updateInput} />
            <TrussGateWizard
              hasExistingStructure={input.supports.length > 0 || input.beams.length > 0}
              onApply={applyTrussGateWizard}
            />
            <SupportList supports={input.supports} onChange={updateSupports} />
            <BeamList beams={input.beams} supports={input.supports} onChange={updateBeams} />
            <div className="grid gap-6 xl:grid-cols-2">
              <StructureRenderer input={input} result={result} />
              <ElevationRenderer input={input} result={result} />
            </div>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Berechnung</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Berechnung, PDF-Report und VW-Import sind direkt in den Arbeitsfluss eingebunden.
              </p>
              <div className="mt-5 space-y-3">
                <Button type="button" className="h-11 w-full text-sm font-semibold" onClick={runCalculation} disabled={isCalculating}>
                  {isCalculating ? "Berechne..." : "Berechnen"}
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

            <ResultSummary result={result} />
            <BallastTable result={result} />
            <BeamResults result={result} />
            <TippingResults result={result} />
          </aside>
        </div>
      </div>
    </main>
  )
}
