"use client"

import { useMemo, useState } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/Tooltip"
import { FOOT_OPTIONS, FOOT_LABELS, TRUSS_OPTIONS } from "@/lib/constants"
import { TOOLTIP_TEXTS } from "@/lib/tooltip-texts"
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
  if (!Number.isFinite(support.height) || support.height < 0.5 || support.height > 20) {
    errors.height = "Höhe muss zwischen 0,5 und 20 m liegen."
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

function ErrorText({ text, tone = "error" }: { text?: string; tone?: "error" | "warning" }) {
  if (!text) return null
  return (
    <p className={cn("mt-2 text-xs", tone === "warning" ? "text-amber-700" : "text-destructive")}>
      {text}
    </p>
  )
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
              <span className="flex items-center gap-2">
                Höhe (m)
                <Tooltip text={TOOLTIP_TEXTS.supportHeight}>(?)</Tooltip>
              </span>
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
                <span className="flex items-center gap-2">
                  Ballast vorhanden (kg)
                  <Tooltip text={TOOLTIP_TEXTS.gammaG}>(?)</Tooltip>
                </span>
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
              Fuß
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
            <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-5">
              <h4 className="text-sm font-semibold">Bodenplatte &amp; Outrigger</h4>

              {/* ── Bodenplatte ────────────────────────────────────── */}
              <div>
                <p className="text-sm font-medium">Bodenplatte — Kantenlänge</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Quadratische Stahl- oder Alugrundplatte direkt unter dem Traversenfuß.
                  Typische Maße: SB-60 = 0,60 m · SB-80 = 0,80 m · SB-100 = 1,00 m
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[0.6, 0.8, 1.0, 1.2].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => updateField("baseplateSize", size)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        (draft.baseplateSize ?? 0.6) === size
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-muted",
                      )}
                    >
                      {size.toFixed(2)} m
                    </button>
                  ))}
                </div>
                <label className="mt-2 block text-xs text-muted-foreground">
                  Anderes Maß:
                  <input
                    className={cn(fieldClassName, errors.baseplateSize && "border-destructive/60")}
                    type="number"
                    min="0.1"
                    step="0.05"
                    value={draft.baseplateSize ?? ""}
                    onChange={(event) => updateField("baseplateSize", Number(event.target.value))}
                  />
                  <ErrorText text={errors.baseplateSize} />
                </label>
              </div>

              {/* ── Outrigger ──────────────────────────────────────── */}
              <div>
                <p className="text-sm font-medium">Outrigger — Länge des Ausleger-Traversenstücks</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Traversenstück das nach <strong>hinten</strong> vom Fuß wegläuft und den Ballast trägt.
                  Maß = Stützen-Achse → Ballastauflager. <strong>0 = kein Outrigger.</strong>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[0, 1.0, 1.5, 2.0, 2.5].map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => updateField("outriggerLength", len)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        (draft.outriggerLength ?? 0) === len
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-muted",
                      )}
                    >
                      {len === 0 ? "Kein" : `${len.toFixed(1)} m`}
                    </button>
                  ))}
                </div>
                <label className="mt-2 block text-xs text-muted-foreground">
                  Anderes Maß:
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

              {/* ── Kipparm-Info ───────────────────────────────────── */}
              {(draft.outriggerLength ?? 0) > 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <p className="font-semibold">Kipparm aus Fußsystem</p>
                  <p className="mt-1">
                    Mit Outrigger: <strong>{(draft.outriggerLength ?? 0).toFixed(2)} m</strong> — Hebelarm von der
                    Stützenachse bis zum Ballastauflager (IBC-Container / Wasserballast).
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold">Kein Outrigger — geringer Kipparm</p>
                  <p className="mt-1">
                    Ohne Outrigger wirkt nur die halbe Plattenbreite als Kipparm:{" "}
                    <strong>{((draft.baseplateSize ?? 0.6) / 2).toFixed(2)} m</strong>.
                    Bei Windangriff steigt der Ballastbedarf erheblich. Outrigger-Traverse oder
                    Betonblöcke (Kipparm 0,60 m) deutlich vorteilhafter.
                  </p>
                </div>
              )}
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
