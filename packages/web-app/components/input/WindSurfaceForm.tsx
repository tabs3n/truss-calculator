"use client"

import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  compassAngleToVector,
  getWindDirectionDisplay,
  getWindSurfaceTypeDragCoefficient,
  normalizeWindDirectionAngle,
  WIND_SURFACE_TYPE_OPTIONS,
} from "@/lib/constants"
import type { Beam, WindSurface } from "@/lib/types-bridge"
import { cn } from "@/lib/utils"

const fieldClassName =
  "mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none"

function OrientationPreview({ angleDeg }: { angleDeg: number }) {
  const normalizedAngle = normalizeWindDirectionAngle(angleDeg)
  const vector = compassAngleToVector(normalizedAngle)
  const arrowX = 60 + vector.x * 30
  const arrowY = 60 + vector.y * 30

  return (
    <div className="rounded-2xl border border-border/80 bg-card/80 p-3">
      <svg viewBox="0 0 120 120" className="mx-auto h-24 w-24">
        <circle cx="60" cy="60" r="40" className="fill-background stroke-border" strokeWidth="1.5" />
        <path d="M60 18v84 M18 60h84" className="stroke-border/60" strokeWidth="1.25" />
        <rect x="44" y="48" width="32" height="24" rx="5" className="fill-sky-100 stroke-sky-300" strokeWidth="1.5" />
        <line x1="60" y1="60" x2={arrowX} y2={arrowY} stroke="#0284c7" strokeWidth="4" strokeLinecap="round" />
        <circle cx={arrowX} cy={arrowY} r="4" fill="#0284c7" />
        <text x="60" y="14" textAnchor="middle" className="fill-muted-foreground text-[10px] font-semibold">
          N
        </text>
      </svg>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Frontansicht: {getWindDirectionDisplay(normalizedAngle)}
      </p>
    </div>
  )
}

export function WindSurfaceForm({
  windSurface,
  frameBeamOptions = [],
  onChange,
  onRemove,
}: {
  windSurface: WindSurface
  frameBeamOptions?: Beam[]
  onChange: (windSurface: WindSurface) => void
  onRemove: () => void
}) {
  const errors = {
    label: windSurface.label.trim() ? "" : "Bezeichnung fehlt.",
    width: windSurface.width > 0 ? "" : "Breite muss größer als 0 sein.",
    height: windSurface.height > 0 ? "" : "Höhe muss größer als 0 sein.",
    centerHeightAboveGround:
      windSurface.centerHeightAboveGround > 0 ? "" : "Höhe über Grund muss größer als 0 sein.",
    surfaceOrientationDeg: Number.isFinite(windSurface.surfaceOrientationDeg) ? "" : "Ausrichtung ist ungültig.",
    dragCoefficient: windSurface.dragCoefficient > 0 ? "" : "c_f muss größer als 0 sein.",
    frame:
      windSurface.frameMode === "FILL_TRUSS_FRAME" && !windSurface.bottomBeamId
        ? "Untere Traverse auswählen."
        : "",
  }

  const selectedSurfaceType = WIND_SURFACE_TYPE_OPTIONS.find((option) => option.value === windSurface.surfaceType)
  const computedDragCoefficient =
    windSurface.surfaceType === "CUSTOM"
      ? windSurface.dragCoefficient
      : getWindSurfaceTypeDragCoefficient(windSurface.surfaceType)

  return (
    <div className="rounded-2xl border border-border bg-background/85 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold">{windSurface.label || "Neue Windfläche"}</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Fläche, Schwerpunktlage, Typ und Orientierung pflegen.
          </p>
        </div>
        <Button type="button" variant="outline" size="icon" onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="block text-sm font-medium xl:col-span-1">
          Label
          <input
            className={cn(fieldClassName, errors.label && "border-destructive/60")}
            value={windSurface.label}
            onChange={(event) => onChange({ ...windSurface, label: event.target.value })}
          />
          {errors.label ? <p className="mt-2 text-xs text-destructive">{errors.label}</p> : null}
        </label>

        <label className="block text-sm font-medium xl:col-span-2">
          Oberflächentyp
          <select
            className={fieldClassName}
            value={windSurface.surfaceType}
            onChange={(event) => {
              const surfaceType = event.target.value as WindSurface["surfaceType"]
              const dragCoefficient = getWindSurfaceTypeDragCoefficient(surfaceType)

              onChange({
                ...windSurface,
                surfaceType,
                dragCoefficient: dragCoefficient ?? windSurface.dragCoefficient,
              })
            }}
          >
            {WIND_SURFACE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            {windSurface.surfaceType === "CUSTOM"
              ? "Benutzerdefinierter c_f-Wert."
              : `Automatischer c_f-Wert: ${computedDragCoefficient?.toFixed(2) ?? "-"} (${selectedSurfaceType?.label})`}
          </p>
        </label>

        <label className="block text-sm font-medium">
          Breite (m)
          <input
            className={cn(fieldClassName, errors.width && "border-destructive/60")}
            type="number"
            min="0"
            step="0.05"
            value={windSurface.width}
            onChange={(event) => onChange({ ...windSurface, width: Number(event.target.value) })}
          />
          {errors.width ? <p className="mt-2 text-xs text-destructive">{errors.width}</p> : null}
        </label>

        <label className="block text-sm font-medium">
          Höhe (m)
          <input
            className={cn(fieldClassName, errors.height && "border-destructive/60")}
            type="number"
            min="0"
            step="0.05"
            value={windSurface.height}
            onChange={(event) => onChange({ ...windSurface, height: Number(event.target.value) })}
          />
          {errors.height ? <p className="mt-2 text-xs text-destructive">{errors.height}</p> : null}
        </label>

        <label className="block text-sm font-medium">
          Schwerpunkt-Höhe (m)
          <input
            className={cn(fieldClassName, errors.centerHeightAboveGround && "border-destructive/60")}
            type="number"
            min="0"
            step="0.05"
            value={windSurface.centerHeightAboveGround}
            onChange={(event) =>
              onChange({ ...windSurface, centerHeightAboveGround: Number(event.target.value) })
            }
          />
          {errors.centerHeightAboveGround ? (
            <p className="mt-2 text-xs text-destructive">{errors.centerHeightAboveGround}</p>
          ) : null}
        </label>

        <label className="block text-sm font-medium xl:col-span-2">
          Einspannung
          <select
            className={cn(fieldClassName, errors.frame && "border-destructive/60")}
            value={windSurface.frameMode ?? "MANUAL"}
            onChange={(event) => {
              const frameMode = event.target.value as NonNullable<WindSurface["frameMode"]>
              if (frameMode === "FILL_TRUSS_FRAME") {
                onChange({
                  ...windSurface,
                  frameMode,
                  bottomBeamId: windSurface.bottomBeamId ?? frameBeamOptions[0]?.id,
                  edgeInsetM: windSurface.edgeInsetM ?? 0.05,
                })
                return
              }

              onChange({
                ...windSurface,
                frameMode: "MANUAL",
                bottomBeamId: undefined,
                edgeInsetM: undefined,
              })
            }}
          >
            <option value="MANUAL">Manuell platzieren</option>
            <option value="FILL_TRUSS_FRAME" disabled={frameBeamOptions.length === 0}>
              In Truss-Rahmen einspannen
            </option>
          </select>
          {errors.frame ? <p className="mt-2 text-xs text-destructive">{errors.frame}</p> : null}
          {frameBeamOptions.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Für Rahmenfüllung zuerst eine tiefere Untertraverse mit denselben Stützen anlegen.
            </p>
          ) : null}
        </label>

        {windSurface.frameMode === "FILL_TRUSS_FRAME" ? (
          <>
            <label className="block text-sm font-medium xl:col-span-2">
              Untere Traverse
              <select
                className={cn(fieldClassName, errors.frame && "border-destructive/60")}
                value={windSurface.bottomBeamId ?? ""}
                onChange={(event) => onChange({ ...windSurface, bottomBeamId: event.target.value })}
              >
                <option value="">Untertraverse wählen</option>
                {frameBeamOptions.map((beam) => (
                  <option key={beam.id} value={beam.id}>
                    {beam.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Rahmenabstand (m)
              <input
                className={fieldClassName}
                type="number"
                min="0"
                step="0.01"
                value={windSurface.edgeInsetM ?? 0.05}
                onChange={(event) => onChange({ ...windSurface, edgeInsetM: Number(event.target.value) })}
              />
            </label>
          </>
        ) : null}

        <label className="block text-sm font-medium">
          Ausrichtung (Grad)
          <input
            className={cn(fieldClassName, errors.surfaceOrientationDeg && "border-destructive/60")}
            type="number"
            step="5"
            value={windSurface.surfaceOrientationDeg}
            onChange={(event) =>
              onChange({ ...windSurface, surfaceOrientationDeg: Number(event.target.value) })
            }
          />
          {errors.surfaceOrientationDeg ? (
            <p className="mt-2 text-xs text-destructive">{errors.surfaceOrientationDeg}</p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              0 Grad = Fläche zeigt nach Norden. Blickrichtung auf die Fläche von vorne.
            </p>
          )}
        </label>

        {windSurface.surfaceType === "CUSTOM" ? (
          <label className="block text-sm font-medium">
            c_f
            <input
              className={cn(fieldClassName, errors.dragCoefficient && "border-destructive/60")}
              type="number"
              min="0"
              step="0.1"
              value={windSurface.dragCoefficient}
              onChange={(event) =>
                onChange({ ...windSurface, dragCoefficient: Number(event.target.value) })
              }
            />
            {errors.dragCoefficient ? (
              <p className="mt-2 text-xs text-destructive">{errors.dragCoefficient}</p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Nur für benutzerdefinierte Oberflächen.</p>
            )}
          </label>
        ) : (
          <div className="block text-sm font-medium">
            Effektiver c_f
            <div className="mt-2 flex h-10 items-center rounded-xl border border-border bg-muted/40 px-3 text-sm font-semibold">
              {computedDragCoefficient?.toFixed(2) ?? "-"}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Wird aus dem Oberflächentyp uebernommen.</p>
          </div>
        )}

        <div className="md:col-span-2 xl:col-span-2">
          <p className="text-sm font-medium">Orientierungsvorschau</p>
          <div className="mt-2">
            <OrientationPreview angleDeg={windSurface.surfaceOrientationDeg} />
          </div>
        </div>
      </div>
    </div>
  )
}
