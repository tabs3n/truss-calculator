"use client"

import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { WindSurface } from "@/lib/types-bridge"
import { cn } from "@/lib/utils"

const fieldClassName =
  "mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none"

export function WindSurfaceForm({
  windSurface,
  onChange,
  onRemove,
}: {
  windSurface: WindSurface
  onChange: (windSurface: WindSurface) => void
  onRemove: () => void
}) {
  const errors = {
    label: windSurface.label.trim() ? "" : "Bezeichnung fehlt.",
    width: windSurface.width > 0 ? "" : "Breite muss groesser als 0 sein.",
    height: windSurface.height > 0 ? "" : "Hoehe muss groesser als 0 sein.",
    centerHeightAboveGround:
      windSurface.centerHeightAboveGround > 0 ? "" : "Hoehe ueber Grund muss groesser als 0 sein.",
    dragCoefficient: windSurface.dragCoefficient > 0 ? "" : "c_f muss groesser als 0 sein.",
  }

  return (
    <div className="rounded-2xl border border-border bg-background/85 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold">{windSurface.label || "Neue Windflaeche"}</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Flaeche, Schwerpunktlage und Winddruckbeiwert pflegen.
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
          Hoehe (m)
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
          Schwerpunkt-Hoehe (m)
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
            <p className="mt-2 text-xs text-muted-foreground">Default gemaess Vorgabe: 1.3</p>
          )}
        </label>
      </div>
    </div>
  )
}
