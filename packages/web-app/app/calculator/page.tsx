"use client"

import { ProjectForm } from "@/components/input/ProjectForm"
import { BeamList } from "@/components/input/BeamList"
import { SupportList } from "@/components/input/SupportList"
import { ReportButton } from "@/components/report/ReportButton"
import { ElevationRenderer } from "@/components/rendering/ElevationRenderer"
import { StructureRenderer } from "@/components/rendering/StructureRenderer"
import { ResultSummary } from "@/components/results/ResultSummary"
import { Button } from "@/components/ui/button"
import { useCalculation } from "@/hooks/useCalculation"
import type { Beam, StructureInput, Support } from "@/lib/types-bridge"

export default function CalculatorPage() {
  const { input, setInput, result, isCalculating, error, runCalculation } = useCalculation()

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

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <section className="rounded-[1.75rem] border border-border/70 bg-card/90 px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Arbeitsoberflaeche
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Truss Calculator
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Eingaben, Visualisierung und Ergebnisbereich sind bereits getrennt angelegt.
                Die `calc-engine` wird spaeter nur noch an den vorhandenen Hook angeschlossen.
              </p>
            </div>

            <div className="grid gap-3 rounded-2xl border border-border bg-background/80 p-4 text-sm text-muted-foreground sm:grid-cols-3">
              <div>
                <p className="font-semibold text-foreground">{input.supports.length}</p>
                <p>Stuetzen</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">{input.beams.length}</p>
                <p>Traversen</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {input.beams.reduce((sum, beam) => sum + beam.loads.length, 0)}
                </p>
                <p>Haengelasten</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-6">
            <ProjectForm input={input} onChange={updateInput} />
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
                Der Hook ist vorbereitet. Bis zur echten Anbindung liefert der Platzhalter bewusst
                eine klare Fehlermeldung.
              </p>
              <div className="mt-5 space-y-3">
                <Button type="button" className="h-11 w-full text-sm font-semibold" onClick={runCalculation} disabled={isCalculating}>
                  {isCalculating ? "Berechne..." : "Berechnen"}
                </Button>
                <ReportButton />
              </div>
              {error ? (
                <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-border bg-background/80 p-4 text-sm text-muted-foreground">
                  Noch keine echte Ergebnisberechnung verfuegbar. Die UI ist fuer die spaetere
                  `calculate()`-Anbindung vorbereitet.
                </div>
              )}
            </section>

            <ResultSummary result={result} />
          </aside>
        </div>
      </div>
    </main>
  )
}
