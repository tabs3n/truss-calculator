"use client"

import { useMemo, useState } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FOOT_OPTIONS, FOOT_LABELS, TRUSS_OPTIONS } from "@/lib/constants"
import type { FootType, Support, TrussType } from "@/lib/types-bridge"
import { cn } from "@/lib/utils"

const fieldClassName =
  "mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none"

const CONCRETE_BLOCK_WEIGHT_KG = 1250
const CONCRETE_BLOCK_FOOTPRINT_MM = 1200

function validateSupport(support: Support) {
  const errors: Record<string, string> = {}

  if (!support.label.trim()) errors.label = "Label ist erforderlich."
  if (!Number.isFinite(support.position.x)) errors.x = "X muss eine Zahl sein."
  if (!Number.isFinite(support.position.y)) errors.y = "Y muss eine Zahl sein."
  if (!Number.isFinite(support.height) || support.height <= 0) {
    errors.height = "Höhe muss größer als 0 sein."
  }
  if (!Number.isFinite(support.existingBallast) || support.existingBallast < 0) {
    errors.existingBallast = "Ballast darf nicht negativ sein."
  }
  if (support.footType === "CONCRETE_BLOCK_1250") {
    if (
      !Number.isFinite(support.numberOfConcreteBlocks) ||
      (support.numberOfConcreteBlocks ?? 0) < 1
    ) {
      errors.numberOfConcreteBlocks = "Mindestens ein Betonblock ist erforderlich."
    }
  }
  if (support.footType === "BASEPLATE") {
    if (!Number.isFinite(support.baseplateSize) || (support.baseplateSize ?? 0) <= 0) {
      errors.baseplateSize = "Plattengröße für Bodenplatte angeben."
    }
    if (
      support.outriggerLength !== undefined &&
      (!Number.isFinite(support.outriggerLength) || support.outriggerLength < 0)
    ) {
      errors.outriggerLength = "Auslegerlänge darf nicht negativ sein."
    }
  }

  return errors
}

function normalizeSupport(support: Support): Support {
  if (support.footType === "CONCRETE_BLOCK_1250") {
    const numberOfConcreteBlocks = Math.max(1, support.numberOfConcreteBlocks ?? 1)

    return {
      ...support,
      baseplateSize: undefined,
      outriggerLength: undefined,
      numberOfConcreteBlocks,
      existingBallast: numberOfConcreteBlocks * CONCRETE_BLOCK_WEIGHT_KG,
    }
  }

  if (support.footType !== "BASEPLATE") {
    return {
      ...support,
      baseplateSize: undefined,
      outriggerLength: undefined,
      numberOfConcreteBlocks: undefined,
    }
  }

  return {
    ...support,
    numberOfConcreteBlocks: undefined,
  }
}

function ErrorText({ text }: { text?: string }) {
  return text ? <p className="mt-2 text-xs text-destructive">{text}</p> : null
}

export function SupportForm({
  open,
  support,
  onClose,
  onSave,
}: {
  open: boolean
  support: Support
  onClose: () => void
  onSave: (support: Support) => void
}) {
  const [draft, setDraft] = useState<Support>(() => support)

  const errors = useMemo(() => validateSupport(draft), [draft])
  const isBaseplate = draft.footType === "BASEPLATE"
  const isConcreteBlock = draft.footType === "CONCRETE_BLOCK_1250"
  const numberOfConcreteBlocks = Math.max(1, draft.numberOfConcreteBlocks ?? 1)
  const concreteBlockBallastKg = numberOfConcreteBlocks * CONCRETE_BLOCK_WEIGHT_KG

  if (!open) return null

  const updateField = <K extends keyof Support>(key: K, value: Support[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const updatePosition = (key: "x" | "y", value: number) => {
    setDraft((current) => ({
      ...current,
      position: { ...current.position, [key]: value },
    }))
  }

  const updateFootType = (footType: FootType) => {
    setDraft((current) => {
      if (footType === "CONCRETE_BLOCK_1250") {
        const nextBlocks = Math.max(1, current.numberOfConcreteBlocks ?? 1)

        return {
          ...current,
          footType,
          numberOfConcreteBlocks: nextBlocks,
          existingBallast: nextBlocks * CONCRETE_BLOCK_WEIGHT_KG,
          baseplateSize: undefined,
          outriggerLength: undefined,
        }
      }

      if (footType === "BASEPLATE") {
        return {
          ...current,
          footType,
          existingBallast: current.existingBallast > 0 ? current.existingBallast : 0,
          baseplateSize: current.baseplateSize ?? 0.6,
          outriggerLength: current.outriggerLength ?? 0,
          numberOfConcreteBlocks: undefined,
        }
      }

      return {
        ...current,
        footType,
        baseplateSize: undefined,
        outriggerLength: undefined,
        numberOfConcreteBlocks: undefined,
      }
    })
  }

  const updateConcreteBlockCount = (nextCount: number) => {
    const numberOfBlocks = Math.max(1, nextCount)

    setDraft((current) => ({
      ...current,
      footType: "CONCRETE_BLOCK_1250",
      numberOfConcreteBlocks: numberOfBlocks,
      existingBallast: numberOfBlocks * CONCRETE_BLOCK_WEIGHT_KG,
    }))
  }

  const canSave = Object.keys(errors).length === 0

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Stützenformular
            </p>
            <h3 className="mt-2 text-2xl font-semibold">{draft.label || "Neue Stütze"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Position, Höhe, Traversentyp und Fußdetail pflegen.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Schliessen">
            <X />
          </Button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium sm:col-span-2">
              Label
              <input
                className={cn(fieldClassName, errors.label && "border-destructive/60")}
                value={draft.label}
                onChange={(event) => updateField("label", event.target.value)}
              />
              <ErrorText text={errors.label} />
            </label>

            <label className="block text-sm font-medium">
              X (m)
              <input
                className={cn(fieldClassName, errors.x && "border-destructive/60")}
                type="number"
                step="0.1"
                value={draft.position.x}
                onChange={(event) => updatePosition("x", Number(event.target.value))}
              />
              <ErrorText text={errors.x} />
            </label>

            <label className="block text-sm font-medium">
              Y (m)
              <input
                className={cn(fieldClassName, errors.y && "border-destructive/60")}
                type="number"
                step="0.1"
                value={draft.position.y}
                onChange={(event) => updatePosition("y", Number(event.target.value))}
              />
              <ErrorText text={errors.y} />
            </label>

            <label className="block text-sm font-medium">
              Höhe (m)
              <input
                className={cn(fieldClassName, errors.height && "border-destructive/60")}
                type="number"
                min="0"
                step="0.1"
                value={draft.height}
                onChange={(event) => updateField("height", Number(event.target.value))}
              />
              <ErrorText text={errors.height} />
            </label>

            {!isConcreteBlock ? (
              <label className="block text-sm font-medium">
                Ballast vorhanden (kg)
                <input
                  className={cn(fieldClassName, errors.existingBallast && "border-destructive/60")}
                  type="number"
                  min="0"
                  step="1"
                  value={draft.existingBallast}
                  onChange={(event) => updateField("existingBallast", Number(event.target.value))}
                />
                <ErrorText text={errors.existingBallast} />
              </label>
            ) : null}

            <label className="block text-sm font-medium">
              Traversentyp
              <select
                className={fieldClassName}
                value={draft.trussType}
                onChange={(event) => updateField("trussType", event.target.value as TrussType)}
              >
                {TRUSS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Fuss
              <select
                className={fieldClassName}
                value={draft.footType}
                onChange={(event) => updateFootType(event.target.value as FootType)}
              >
                {FOOT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">{FOOT_LABELS[draft.footType]}</p>
            </label>
          </div>

          {isConcreteBlock ? (
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <h4 className="text-sm font-semibold">Betonblockparameter</h4>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-background/80 p-3">
                  <p className="text-sm font-medium">Eigengewicht</p>
                  <p className="mt-1 text-lg font-semibold">1.250 kg</p>
                  <p className="mt-1 text-xs text-muted-foreground">Zaehlt als Ballast.</p>
                </div>

                <div className="rounded-xl border border-border bg-background/80 p-3">
                  <p className="text-sm font-medium">Standflaeche</p>
                  <p className="mt-1 text-lg font-semibold">
                    {CONCRETE_BLOCK_FOOTPRINT_MM.toLocaleString("de-DE")} x {CONCRETE_BLOCK_FOOTPRINT_MM.toLocaleString("de-DE")} mm
                  </p>
                </div>

                <label className="block text-sm font-medium">
                  Anzahl Bloecke
                  <input
                    className={cn(fieldClassName, errors.numberOfConcreteBlocks && "border-destructive/60")}
                    type="number"
                    min="1"
                    step="1"
                    value={numberOfConcreteBlocks}
                    onChange={(event) => updateConcreteBlockCount(Number(event.target.value))}
                  />
                  <ErrorText text={errors.numberOfConcreteBlocks} />
                </label>

                <div className="rounded-xl border border-border bg-background/80 p-3">
                  <p className="text-sm font-medium">Gesamtballast</p>
                  <p className="mt-1 text-lg font-semibold">
                    {concreteBlockBallastKg.toLocaleString("de-DE")} kg
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {isBaseplate ? (
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <h4 className="text-sm font-semibold">Bodenplattenparameter</h4>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  Kantenlänge Platte (m)
                  <input
                    className={cn(fieldClassName, errors.baseplateSize && "border-destructive/60")}
                    type="number"
                    min="0"
                    step="0.05"
                    value={draft.baseplateSize ?? ""}
                    onChange={(event) => updateField("baseplateSize", Number(event.target.value))}
                  />
                  <ErrorText text={errors.baseplateSize} />
                </label>

                <label className="block text-sm font-medium">
                  Outrigger-Länge (m)
                  <input
                    className={cn(fieldClassName, errors.outriggerLength && "border-destructive/60")}
                    type="number"
                    min="0"
                    step="0.05"
                    value={draft.outriggerLength ?? ""}
                    onChange={(event) => updateField("outriggerLength", Number(event.target.value))}
                  />
                  <ErrorText text={errors.outriggerLength} />
                </label>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t border-border px-6 py-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() => {
              if (!canSave) return
              onSave(normalizeSupport(draft))
            }}
          >
            Stütze speichern
          </Button>
        </div>
      </div>
    </div>
  )
}
