"use client"

import { useMemo, useState } from "react"
import { Plus, X } from "lucide-react"

import { LoadForm } from "@/components/input/LoadForm"
import { WindSurfaceForm } from "@/components/input/WindSurfaceForm"
import { Button } from "@/components/ui/button"
import { getWindSurfaceTypeDragCoefficient, TRUSS_OPTIONS } from "@/lib/constants"
import type { Beam, HangingLoad, Support, TrussType, WindSurface } from "@/lib/types-bridge"
import { cn } from "@/lib/utils"

const fieldClassName =
  "mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none"

function distanceBetweenSupports(beam: Beam, supports: Support[]) {
  const start = supports.find((support) => support.id === beam.startSupportId)
  const end = supports.find((support) => support.id === beam.endSupportId)

  if (!start || !end) return 0

  return Math.hypot(end.position.x - start.position.x, end.position.y - start.position.y)
}

function validateBeam(beam: Beam, supports: Support[], spanLength: number) {
  const errors: Record<string, string> = {}
  const minLoadPosition = -beam.cantileverStart
  const maxLoadPosition = spanLength + beam.cantileverEnd

  if (!beam.label.trim()) errors.label = "Label ist erforderlich."
  if (!beam.startSupportId) errors.startSupportId = "Startstuetze auswaehlen."
  if (!beam.endSupportId) errors.endSupportId = "Endstuetze auswaehlen."
  if (beam.startSupportId && beam.startSupportId === beam.endSupportId) {
    errors.endSupportId = "Start und Ende muessen verschieden sein."
  }
  if (supports.length < 2) errors.supports = "Mindestens zwei Stützen erforderlich."
  if (beam.cantileverStart < 0) errors.cantileverStart = "Auskragung darf nicht negativ sein."
  if (beam.cantileverEnd < 0) errors.cantileverEnd = "Auskragung darf nicht negativ sein."

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
  })

  return errors
}

function createLoad(index: number): HangingLoad {
  return {
    id: crypto.randomUUID(),
    label: `Last ${index + 1}`,
    positionAlongBeam: 0,
    weight: 50,
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
  supports,
  onClose,
  onSave,
}: {
  open: boolean
  beam: Beam
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
              Auskragung links (m)
              <input
                className={cn(fieldClassName, errors.cantileverStart && "border-destructive/60")}
                type="number"
                min="0"
                step="0.05"
                value={draft.cantileverStart}
                onChange={(event) => updateField("cantileverStart", Number(event.target.value))}
              />
              {errors.cantileverStart ? (
                <p className="mt-2 text-xs text-destructive">{errors.cantileverStart}</p>
              ) : null}
            </label>

            <label className="block text-sm font-medium">
              Auskragung rechts (m)
              <input
                className={cn(fieldClassName, errors.cantileverEnd && "border-destructive/60")}
                type="number"
                min="0"
                step="0.05"
                value={draft.cantileverEnd}
                onChange={(event) => updateField("cantileverEnd", Number(event.target.value))}
              />
              {errors.cantileverEnd ? (
                <p className="mt-2 text-xs text-destructive">{errors.cantileverEnd}</p>
              ) : null}
            </label>
          </div>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-lg font-semibold">Hängelasten</h4>
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

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-lg font-semibold">Windangriffsflaechen</h4>
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
          <Button type="button" disabled={!canSave} onClick={() => canSave && onSave(draft)}>
            Traverse speichern
          </Button>
        </div>
      </div>
    </div>
  )
}
