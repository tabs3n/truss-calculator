"use client"

import { useMemo, useState } from "react"
import { Plus, X } from "lucide-react"

import { LoadForm } from "@/components/input/LoadForm"
import { WindSurfaceForm } from "@/components/input/WindSurfaceForm"
import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/Tooltip"
import { getOrderedBeamSupportIds, getBeamPolylineLengthM } from "@/lib/beam-helpers"
import { getWindSurfaceTypeDragCoefficient, TRUSS_OPTIONS } from "@/lib/constants"
import { getBeamDisplayHeightM, getLowerFrameBeamOptions } from "@/lib/frame-geometry"
import { TOOLTIP_TEXTS } from "@/lib/tooltip-texts"
import type { Beam, DistributedLoad, HangingLoad, Support, TrussType, WindSurface } from "@/lib/types-bridge"
import { cn } from "@/lib/utils"

const fieldClassName =
  "mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none"

function getBeamSupportIds(beam: Beam): string[] {
  if (beam.supportIds && beam.supportIds.length >= 2) return beam.supportIds
  return [beam.startSupportId, beam.endSupportId]
}

function distanceBetweenSupports(beam: Beam, supports: Support[]) {
  // Verwendet die korrekt sortierte Polylinie (Zwischenstützen nach Projektion)
  return getBeamPolylineLengthM(beam, supports)
}

function validateBeam(beam: Beam, supports: Support[], spanLength: number) {
  const errors: Record<string, string> = {}
  const minLoadPosition = -beam.cantileverStart
  const maxLoadPosition = spanLength + beam.cantileverEnd
  const selectedSupports = getBeamSupportIds(beam)
    .map((supportId) => supports.find((support) => support.id === supportId))
    .filter((support): support is Support => Boolean(support))
  const maxMountHeight = selectedSupports.length > 0
    ? Math.min(...selectedSupports.map((support) => support.height))
    : 0

  if (!beam.label.trim()) errors.label = "Label ist erforderlich."
  if (!beam.startSupportId) errors.startSupportId = "Startstuetze auswaehlen."
  if (!beam.endSupportId) errors.endSupportId = "Endstuetze auswaehlen."
  if (beam.startSupportId && beam.startSupportId === beam.endSupportId) {
    errors.endSupportId = "Start und Ende muessen verschieden sein."
  }
  if (supports.length < 2) errors.supports = "Mindestens zwei Stützen erforderlich."
  if (beam.cantileverStart < 0) errors.cantileverStart = "Auskragung darf nicht negativ sein."
  if (beam.cantileverEnd < 0) errors.cantileverEnd = "Auskragung darf nicht negativ sein."
  if (beam.mountHeightM !== undefined) {
    if (!Number.isFinite(beam.mountHeightM) || beam.mountHeightM < 0) {
      errors.mountHeightM = "Montagehöhe muss größer oder gleich 0 m sein."
    } else if (beam.mountHeightM > maxMountHeight) {
      errors.mountHeightM = `Montagehöhe darf die niedrigste Stütze (${maxMountHeight.toFixed(2)} m) nicht überschreiten.`
    }
  }

  beam.loads.forEach((load) => {
    if (!load.label.trim()) errors[`load-${load.id}-label`] = "Label fehlt."
    if (load.positionAlongBeam < minLoadPosition || load.positionAlongBeam > maxLoadPosition) {
      errors[`load-${load.id}-position`] =
        `Lastposition muss zwischen ${minLoadPosition.toFixed(2)} m und ${maxLoadPosition.toFixed(2)} m liegen.`
    }
    if (load.weight <= 0) errors[`load-${load.id}-weight`] = "Lastgewicht muss größer als 0 sein."
  })

  beam.windSurfaces.forEach((windSurface) => {
    if (!windSurface.label.trim()) errors[`surface-${windSurface.id}-label`] = "Label fehlt."
    if (windSurface.width <= 0) errors[`surface-${windSurface.id}-width`] = "Breite ist ungültig."
    if (windSurface.height <= 0) errors[`surface-${windSurface.id}-height`] = "Höhe ist ungültig."
    if (windSurface.centerHeightAboveGround <= 0) {
      errors[`surface-${windSurface.id}-center`] = "Höhe über Grund ist ungültig."
    }
    if (!Number.isFinite(windSurface.surfaceOrientationDeg)) {
      errors[`surface-${windSurface.id}-orientation`] = "Ausrichtung ist ungültig."
    }
    if (windSurface.surfaceType === "CUSTOM" && windSurface.dragCoefficient <= 0) {
      errors[`surface-${windSurface.id}-drag`] = "c_f ist ungültig."
    }
    if (windSurface.frameMode === "FILL_TRUSS_FRAME" && !windSurface.bottomBeamId) {
      errors[`surface-${windSurface.id}-frame`] = "Untere Traverse für Rahmenfüllung auswählen."
    }
  })

  return errors
}

function validateBeamWarnings(beam: Beam, spanLength: number) {
  const warnings: Record<string, string> = {}

  if (spanLength > 12) {
    warnings.span = "Freie Spannweite über 12 m ist kritisch. Zwischenstütze oder größeren Traversentyp prüfen."
  } else if (beam.trussType === "PROLYTE_H30V" && spanLength > 8) {
    warnings.span = "PROLYTE_H30V erlaubt typischerweise maximal ca. 8 m frei."
  }
  if (beam.cantileverStart > spanLength / 2) {
    warnings.cantileverStart = "Linke Auskragung ist größer als die halbe Spannweite."
  }
  if (beam.cantileverEnd > spanLength / 2) {
    warnings.cantileverEnd = "Rechte Auskragung ist größer als die halbe Spannweite."
  }

  return warnings
}

function FieldIssue({ text, tone = "error" }: { text?: string; tone?: "error" | "warning" }) {
  if (!text) return null
  return (
    <p className={cn("mt-2 text-xs", tone === "warning" ? "text-amber-700" : "text-destructive")}>
      {text}
    </p>
  )
}

function createLoad(index: number): HangingLoad {
  return {
    id: crypto.randomUUID(),
    label: `Last ${index + 1}`,
    positionAlongBeam: 0,
    weight: 50,
  }
}

function createDistributedLoad(index: number, beamLength: number): DistributedLoad {
  return {
    id: crypto.randomUUID(),
    label: `Streckenlast ${index + 1}`,
    startPositionM: 0,
    endPositionM: Math.max(1, beamLength),
    loadKgPerM: 10,
  }
}

function createWindSurface(index: number): WindSurface {
  return {
    id: crypto.randomUUID(),
    label: `Windfläche ${index + 1}`,
    width: 1,
    height: 1,
    centerHeightAboveGround: 4,
    surfaceType: "BANNER_SOLID",
    surfaceOrientationDeg: 0,
    dragCoefficient: getWindSurfaceTypeDragCoefficient("BANNER_SOLID") ?? 1.3,
  }
}

export function BeamForm({
  open,
  beam,
  allBeams,
  supports,
  onClose,
  onSave,
}: {
  open: boolean
  beam: Beam
  allBeams: Beam[]
  supports: Support[]
  onClose: () => void
  onSave: (beam: Beam) => void
}) {
  const [draft, setDraft] = useState<Beam>(() => beam)

  const spanLength = useMemo(() => distanceBetweenSupports(draft, supports), [draft, supports])
  const totalLength = useMemo(
    () => Math.max(0, spanLength + draft.cantileverStart + draft.cantileverEnd),
    [draft.cantileverEnd, draft.cantileverStart, spanLength],
  )
  const minLoadPosition = -draft.cantileverStart
  const maxLoadPosition = spanLength + draft.cantileverEnd
  const errors = useMemo(() => validateBeam(draft, supports, spanLength), [draft, supports, spanLength])
  const warnings = useMemo(() => validateBeamWarnings(draft, spanLength), [draft, spanLength])
  const displayedMountHeight = useMemo(() => getBeamDisplayHeightM(draft, supports), [draft, supports])
  const lowerFrameBeamOptions = useMemo(
    () => getLowerFrameBeamOptions(draft, allBeams, supports),
    [allBeams, draft, supports],
  )

  if (!open) return null

  const updateField = <K extends keyof Beam>(key: K, value: Beam[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const canSave = Object.keys(errors).length === 0

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="flex h-full w-full max-w-3xl flex-col overflow-y-auto border-l border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Traversenformular
            </p>
            <h3 className="mt-2 text-2xl font-semibold">{draft.label || "Neue Traverse"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Verbindungen, Auskragungen, Hängelasten und Windflächen verwalten.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Schliessen">
            <X />
          </Button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="rounded-2xl border border-border bg-muted/25 p-4 text-sm text-muted-foreground">
            Freie Spannweite: <span className="font-semibold text-foreground">{spanLength.toFixed(2)} m</span>
            {" · "}
            Gesamtlänge inkl. Auskragungen:{" "}
            <span className="font-semibold text-foreground">{totalLength.toFixed(2)} m</span>
            <FieldIssue text={warnings.span} tone="warning" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium md:col-span-2">
              Label
              <input
                className={cn(fieldClassName, errors.label && "border-destructive/60")}
                value={draft.label}
                onChange={(event) => updateField("label", event.target.value)}
              />
              {errors.label ? <p className="mt-2 text-xs text-destructive">{errors.label}</p> : null}
            </label>

            <label className="block text-sm font-medium">
              Von
              <select
                className={cn(fieldClassName, errors.startSupportId && "border-destructive/60")}
                value={draft.startSupportId}
                onChange={(event) => updateField("startSupportId", event.target.value)}
              >
                <option value="">Stützen waehlen</option>
                {supports.map((support) => (
                  <option key={support.id} value={support.id}>
                    {support.label}
                  </option>
                ))}
              </select>
              {errors.startSupportId ? (
                <p className="mt-2 text-xs text-destructive">{errors.startSupportId}</p>
              ) : null}
            </label>

            <label className="block text-sm font-medium">
              Bis
              <select
                className={cn(fieldClassName, errors.endSupportId && "border-destructive/60")}
                value={draft.endSupportId}
                onChange={(event) => updateField("endSupportId", event.target.value)}
              >
                <option value="">Stützen waehlen</option>
                {supports.map((support) => (
                  <option key={support.id} value={support.id}>
                    {support.label}
                  </option>
                ))}
              </select>
              {errors.endSupportId ? (
                <p className="mt-2 text-xs text-destructive">{errors.endSupportId}</p>
              ) : null}
            </label>

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
              Montagehöhe (m)
              <input
                className={cn(fieldClassName, errors.mountHeightM && "border-destructive/60")}
                type="number"
                min="0"
                step="0.05"
                placeholder="Stützenkopf"
                value={draft.mountHeightM ?? ""}
                onChange={(event) => {
                  const rawValue = event.target.value
                  updateField("mountHeightM", rawValue === "" ? undefined : Number(rawValue))
                }}
              />
              <FieldIssue text={errors.mountHeightM} />
              {!errors.mountHeightM ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Leer = Stützenkopf
                  {displayedMountHeight !== null ? ` (${displayedMountHeight.toFixed(2)} m)` : ""}.
                  Für untere Quertraversen z.B. 0,45 m.
                </p>
              ) : null}
            </label>

            <label className="block text-sm font-medium">
              <span className="flex items-center gap-2">
                Auskragung links (m)
                <Tooltip text={TOOLTIP_TEXTS.cantilever}>(?)</Tooltip>
              </span>
              <input
                className={cn(fieldClassName, errors.cantileverStart && "border-destructive/60")}
                type="number"
                min="0"
                step="0.05"
                value={draft.cantileverStart}
                onChange={(event) => updateField("cantileverStart", Number(event.target.value))}
              />
              <FieldIssue text={errors.cantileverStart} />
              <FieldIssue text={warnings.cantileverStart} tone="warning" />
            </label>

            <label className="block text-sm font-medium">
              <span className="flex items-center gap-2">
                Auskragung rechts (m)
                <Tooltip text={TOOLTIP_TEXTS.cantilever}>(?)</Tooltip>
              </span>
              <input
                className={cn(fieldClassName, errors.cantileverEnd && "border-destructive/60")}
                type="number"
                min="0"
                step="0.05"
                value={draft.cantileverEnd}
                onChange={(event) => updateField("cantileverEnd", Number(event.target.value))}
              />
              <FieldIssue text={errors.cantileverEnd} />
              <FieldIssue text={warnings.cantileverEnd} tone="warning" />
            </label>
          </div>

          {/* Zwischenstützen für Multi-Support-Traversen */}
          <section className="rounded-2xl border border-border bg-muted/20 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-base font-semibold">Zwischenstützen</h4>
                <p className="text-xs text-muted-foreground">
                  Optionale Stützen zwischen Start und Ende — die Traverse läuft in Reihenfolge durch alle.
                  Multi-Support wird als Aneinanderreihung von Einfeldträgern berechnet (konservativ).
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const current = getBeamSupportIds(draft)
                  const intermediates = current.slice(1, -1)
                  const used = new Set(current)
                  const candidate = supports.find((s) => !used.has(s.id))
                  const nextIntermediates = [...intermediates, candidate?.id ?? ""]
                  updateField("supportIds", [draft.startSupportId, ...nextIntermediates, draft.endSupportId])
                }}
              >
                <Plus />
                Stütze einfügen
              </Button>
            </div>

            {(() => {
              const intermediates = getBeamSupportIds(draft).slice(1, -1)
              if (intermediates.length === 0) {
                return (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Keine Zwischenstützen — klassischer Einfeldträger.
                  </p>
                )
              }
              return (
                <div className="mt-3 space-y-2">
                  {intermediates.map((id, idx) => (
                    <div key={`${id}-${idx}`} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">#{idx + 2}</span>
                      <select
                        className={cn(fieldClassName, "mt-0 flex-1")}
                        value={id}
                        onChange={(event) => {
                          const next = [...intermediates]
                          next[idx] = event.target.value
                          updateField("supportIds", [draft.startSupportId, ...next, draft.endSupportId])
                        }}
                      >
                        <option value="">Stütze wählen</option>
                        {supports.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const next = intermediates.filter((_, i) => i !== idx)
                          updateField("supportIds", [draft.startSupportId, ...next, draft.endSupportId])
                        }}
                        aria-label="Stütze entfernen"
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
              )
            })()}
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="flex items-center gap-2 text-lg font-semibold">
                  Hängelasten
                  <Tooltip text={TOOLTIP_TEXTS.dynamicFactor}>(?)</Tooltip>
                </h4>
                <p className="text-sm text-muted-foreground">
                  Einzellasten entlang der Traverse mit Position in Metern.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => updateField("loads", [...draft.loads, createLoad(draft.loads.length)])}
              >
                <Plus />
                Last hinzufuegen
              </Button>
            </div>

            <div className="space-y-3">
              {draft.loads.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Noch keine Hängelasten erfasst.
                </div>
              ) : null}
              {draft.loads.map((load) => (
                <LoadForm
                  key={load.id}
                  load={load}
                  minPosition={minLoadPosition}
                  maxPosition={maxLoadPosition}
                  onChange={(nextLoad) =>
                    updateField(
                      "loads",
                      draft.loads.map((item) => (item.id === nextLoad.id ? nextLoad : item)),
                    )
                  }
                  onRemove={() =>
                    updateField(
                      "loads",
                      draft.loads.filter((item) => item.id !== load.id),
                    )
                  }
                />
              ))}
            </div>
          </section>

          {/* Streckenlasten */}
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="flex items-center gap-2 text-lg font-semibold">
                  Streckenlasten
                  <Tooltip text={TOOLTIP_TEXTS.distributedLoad}>(?)</Tooltip>
                </h4>
                <p className="text-sm text-muted-foreground">
                  Kontinuierliche Last über einen Abschnitt (z.B. Ketten, Kabelwege, PA-Riser).
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const current = draft.distributedLoads ?? []
                  updateField("distributedLoads", [
                    ...current,
                    createDistributedLoad(current.length, spanLength),
                  ])
                }}
              >
                <Plus />
                Streckenlast hinzufügen
              </Button>
            </div>

            <div className="space-y-3">
              {(draft.distributedLoads ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Noch keine Streckenlasten erfasst.
                </div>
              ) : null}
              {(draft.distributedLoads ?? []).map((dl) => (
                <div key={dl.id} className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-2">
                    <input
                      className={cn(fieldClassName, "mt-0 flex-1")}
                      value={dl.label}
                      placeholder="Beschriftung"
                      onChange={(event) =>
                        updateField(
                          "distributedLoads",
                          (draft.distributedLoads ?? []).map((item) =>
                            item.id === dl.id ? { ...item, label: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        updateField(
                          "distributedLoads",
                          (draft.distributedLoads ?? []).filter((item) => item.id !== dl.id),
                        )
                      }
                    >
                      <X />
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="block text-xs font-medium">
                      Start (m)
                      <input
                        className={fieldClassName}
                        type="number"
                        step="0.05"
                        value={dl.startPositionM}
                        onChange={(event) =>
                          updateField(
                            "distributedLoads",
                            (draft.distributedLoads ?? []).map((item) =>
                              item.id === dl.id
                                ? { ...item, startPositionM: Number(event.target.value) }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="block text-xs font-medium">
                      Ende (m)
                      <input
                        className={fieldClassName}
                        type="number"
                        step="0.05"
                        value={dl.endPositionM}
                        onChange={(event) =>
                          updateField(
                            "distributedLoads",
                            (draft.distributedLoads ?? []).map((item) =>
                              item.id === dl.id
                                ? { ...item, endPositionM: Number(event.target.value) }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="block text-xs font-medium">
                      Last (kg/m)
                      <input
                        className={fieldClassName}
                        type="number"
                        min="0"
                        step="0.5"
                        value={dl.loadKgPerM}
                        onChange={(event) =>
                          updateField(
                            "distributedLoads",
                            (draft.distributedLoads ?? []).map((item) =>
                              item.id === dl.id
                                ? { ...item, loadKgPerM: Number(event.target.value) }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="flex items-center gap-2 text-lg font-semibold">
                  Windangriffsflächen
                  <Tooltip text={TOOLTIP_TEXTS.windSurface}>(?)</Tooltip>
                </h4>
                <p className="text-sm text-muted-foreground">
                  Banner, LED-Waende oder bestueckte Trussbereiche.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  updateField("windSurfaces", [
                    ...draft.windSurfaces,
                    createWindSurface(draft.windSurfaces.length),
                  ])
                }
              >
                <Plus />
                Windfläche hinzufuegen
              </Button>
            </div>

            <div className="space-y-3">
              {draft.windSurfaces.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Noch keine Windflächen hinterlegt.
                </div>
              ) : null}
              {draft.windSurfaces.map((windSurface) => (
                <WindSurfaceForm
                  key={windSurface.id}
                  windSurface={windSurface}
                  frameBeamOptions={lowerFrameBeamOptions}
                  onChange={(nextSurface) =>
                    updateField(
                      "windSurfaces",
                      draft.windSurfaces.map((item) =>
                        item.id === nextSurface.id ? nextSurface : item,
                      ),
                    )
                  }
                  onRemove={() =>
                    updateField(
                      "windSurfaces",
                      draft.windSurfaces.filter((item) => item.id !== windSurface.id),
                    )
                  }
                />
              ))}
            </div>
          </section>

          {errors.supports ? <p className="text-sm text-destructive">{errors.supports}</p> : null}
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
              // Vor dem Speichern: Zwischenstützen nach Position entlang
              // Start→Ende-Vektor sortieren, damit die Polylinie monoton ist
              const orderedIds = getOrderedBeamSupportIds(draft, supports)
              const next: Beam = orderedIds.length >= 2
                ? {
                    ...draft,
                    supportIds: orderedIds,
                    startSupportId: orderedIds[0]!,
                    endSupportId: orderedIds[orderedIds.length - 1]!,
                  }
                : draft
              onSave(next)
            }}
          >
            Traverse speichern
          </Button>
        </div>
      </div>
    </div>
  )
}
