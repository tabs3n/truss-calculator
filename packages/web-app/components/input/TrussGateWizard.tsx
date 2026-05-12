"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  getWindSurfaceTypeDragCoefficient,
  TRUSS_GATE_FILL_OPTIONS,
  TRUSS_LABELS,
  TRUSS_OPTIONS,
  WIND_SURFACE_TYPE_LABELS,
} from "@/lib/constants"
import type { Beam, StructureInput, Support, TrussType, WindSurface } from "@/lib/types-bridge"
import { cn } from "@/lib/utils"

function stepIsValid(step: number, config: WizardConfig) {
  if (step === 0) return config.gateWidth > 0 && config.gateHeight > 0
  if (step === 1) {
    return config.fillType === "EMPTY" || (config.fillWidth > 0 && config.fillHeight > 0)
  }
  return config.outriggerLength >= 0 && config.existingBallast >= 0
}

type FillType = (typeof TRUSS_GATE_FILL_OPTIONS)[number]["value"]

interface WizardConfig {
  gateWidth: number
  gateHeight: number
  trussType: TrussType
  fillType: FillType
  fillWidth: number
  fillHeight: number
  outriggerLength: number
  existingBallast: number
}

const initialConfig: WizardConfig = {
  gateWidth: 6,
  gateHeight: 4,
  trussType: "PROLYTE_H30V",
  fillType: "EMPTY",
  fillWidth: 6,
  fillHeight: 4,
  outriggerLength: 1.5,
  existingBallast: 0,
}

function createGateWindSurface(config: WizardConfig): WindSurface[] {
  if (config.fillType === "EMPTY") return []

  return [
    {
      id: crypto.randomUUID(),
      label: WIND_SURFACE_TYPE_LABELS[config.fillType],
      width: config.fillWidth,
      height: config.fillHeight,
      centerHeightAboveGround: config.fillHeight / 2,
      surfaceType: config.fillType,
      surfaceOrientationDeg: 0,
      dragCoefficient: getWindSurfaceTypeDragCoefficient(config.fillType) ?? 1.0,
    },
  ]
}

function createGateStructure(config: WizardConfig): Pick<StructureInput, "supports" | "beams"> {
  const leftSupportId = crypto.randomUUID()
  const rightSupportId = crypto.randomUUID()

  const supports: Support[] = [
    {
      id: leftSupportId,
      label: "Tower links",
      position: { x: 0, y: 0 },
      trussType: config.trussType,
      height: config.gateHeight,
      footType: "BASEPLATE",
      baseplateSize: 0.6,
      outriggerLength: config.outriggerLength,
      existingBallast: config.existingBallast,
    },
    {
      id: rightSupportId,
      label: "Tower rechts",
      position: { x: config.gateWidth, y: 0 },
      trussType: config.trussType,
      height: config.gateHeight,
      footType: "BASEPLATE",
      baseplateSize: 0.6,
      outriggerLength: config.outriggerLength,
      existingBallast: config.existingBallast,
    },
  ]

  const beams: Beam[] = [
    {
      id: crypto.randomUUID(),
      label: "Tortraverse",
      startSupportId: leftSupportId,
      endSupportId: rightSupportId,
      trussType: config.trussType,
      cantileverStart: 0,
      cantileverEnd: 0,
      loads: [],
      windSurfaces: createGateWindSurface(config),
    },
  ]

  return { supports, beams }
}

export function TrussGateWizard({
  hasExistingStructure,
  onApply,
}: {
  hasExistingStructure: boolean
  onApply: (next: Pick<StructureInput, "supports" | "beams">) => void
}) {
  const [currentStep, setCurrentStep] = useState(0)
  const [config, setConfig] = useState<WizardConfig>(initialConfig)

  const setField = <K extends keyof WizardConfig>(key: K, value: WizardConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }))
  }

  const canGoNext = stepIsValid(currentStep, config)
  const canApply = stepIsValid(0, config) && stepIsValid(1, config) && stepIsValid(2, config)

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Schnellkonfiguration Traversentor</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Drei Schritte für ein startfertiges Traversentor. Danach kann alles in der normalen
            Eingabemaske weiter bearbeitet werden.
          </p>
        </div>
        <div className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Schritt {currentStep + 1} / 3
        </div>
      </div>

      {hasExistingStructure ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
          Bestehende Stützen und Traversen werden beim Übernehmen durch die Wizard-Konfiguration ersetzt.
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {[
          { title: "1. Abmessungen", text: `${config.gateWidth.toFixed(2)} m x ${config.gateHeight.toFixed(2)} m` },
          { title: "2. Fuellung", text: config.fillType === "EMPTY" ? "Leer" : WIND_SURFACE_TYPE_LABELS[config.fillType] },
          { title: "3. Fuss", text: `${config.outriggerLength.toFixed(2)} m Ausleger` },
        ].map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setCurrentStep(index)}
            className={cn(
              "rounded-2xl border px-4 py-3 text-left transition-colors",
              currentStep === index
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted",
            )}
          >
            <span className="block text-sm font-semibold">{item.title}</span>
            <span className="mt-1 block text-xs opacity-80">{item.text}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-border/80 bg-background/70 p-4">
        {currentStep === 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm font-medium">
              Torbreite (m)
              <input
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none"
                type="number"
                min="0"
                step="0.1"
                value={config.gateWidth}
                onChange={(event) => setField("gateWidth", Number(event.target.value))}
              />
            </label>
            <label className="block text-sm font-medium">
              Torhoehe (m)
              <input
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none"
                type="number"
                min="0"
                step="0.1"
                value={config.gateHeight}
                onChange={(event) => setField("gateHeight", Number(event.target.value))}
              />
            </label>
            <label className="block text-sm font-medium">
              Traversentyp
              <select
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none"
                value={config.trussType}
                onChange={(event) => setField("trussType", event.target.value as TrussType)}
              >
                {TRUSS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">{TRUSS_LABELS[config.trussType]}</p>
            </label>
          </div>
        ) : null}

        {currentStep === 1 ? (
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm font-medium md:col-span-3">
              Fuellung
              <div className="mt-2 grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {TRUSS_GATE_FILL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setField("fillType", option.value)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left transition-colors",
                      config.fillType === option.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted",
                    )}
                  >
                    <span className="block text-sm font-semibold">{option.label}</span>
                  </button>
                ))}
              </div>
            </label>

            {config.fillType !== "EMPTY" ? (
              <>
                <label className="block text-sm font-medium">
                  Fuellbreite (m)
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none"
                    type="number"
                    min="0"
                    step="0.1"
                    value={config.fillWidth}
                    onChange={(event) => setField("fillWidth", Number(event.target.value))}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Fuellhoehe (m)
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none"
                    type="number"
                    min="0"
                    step="0.1"
                    value={config.fillHeight}
                    onChange={(event) => setField("fillHeight", Number(event.target.value))}
                  />
                </label>
                <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 text-sm text-slate-700">
                  Die Windfläche wird mit Ausrichtung 0 Grad angelegt und kann danach in der normalen
                  Eingabemaske weiter angepasst werden.
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground md:col-span-3">
                Leer erzeugt nur die Grundstruktur ohne Windfläche.
              </div>
            )}
          </div>
        ) : null}

        {currentStep === 2 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Auslegerlänge (m)
              <input
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none"
                type="number"
                min="0"
                step="0.1"
                value={config.outriggerLength}
                onChange={(event) => setField("outriggerLength", Number(event.target.value))}
              />
            </label>
            <label className="block text-sm font-medium">
              Vorhandener Ballast je Stütze (kg)
              <input
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none"
                type="number"
                min="0"
                step="1"
                value={config.existingBallast}
                onChange={(event) => setField("existingBallast", Number(event.target.value))}
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={() => setCurrentStep((step) => Math.max(0, step - 1))} disabled={currentStep === 0}>
          Zurueck
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row">
          {currentStep < 2 ? (
            <Button type="button" onClick={() => canGoNext && setCurrentStep((step) => Math.min(2, step + 1))} disabled={!canGoNext}>
              Weiter
            </Button>
          ) : (
            <Button type="button" onClick={() => canApply && onApply(createGateStructure(config))} disabled={!canApply}>
              Traversentor übernehmen
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
