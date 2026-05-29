"use client"

import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { HangingLoad } from "@/lib/types-bridge"
import { cn } from "@/lib/utils"

const fieldClassName =
  "mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none"

export function LoadForm({
  load,
  minPosition,
  maxPosition,
  onChange,
  onRemove,
}: {
  load: HangingLoad
  minPosition: number
  maxPosition: number
  onChange: (load: HangingLoad) => void
  onRemove: () => void
}) {
  const errors = {
    label: load.label.trim() ? "" : "Bezeichnung fehlt.",
    position:
      Number.isFinite(load.positionAlongBeam) &&
      load.positionAlongBeam >= minPosition &&
      load.positionAlongBeam <= maxPosition
        ? ""
        : `Position muss zwischen ${minPosition.toFixed(2)} und ${maxPosition.toFixed(2)} m liegen.`,
    weight:
      Number.isFinite(load.weight) && load.weight > 0 ? "" : "Gewicht muss größer als 0 sein.",
  }

  return (
    <div className="rounded-2xl border border-border bg-background/85 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold">{load.label || "Neue Hängelast"}</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Position ab linkem Auflager. Linke Auskragungen werden negativ eingegeben.
          </p>
        </div>
        <Button type="button" variant="outline" size="icon" onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <label className="block text-sm font-medium">
          Label
          <input
            className={cn(fieldClassName, errors.label && "border-destructive/60")}
            value={load.label}
            onChange={(event) => onChange({ ...load, label: event.target.value })}
          />
          {errors.label ? <p className="mt-2 text-xs text-destructive">{errors.label}</p> : null}
        </label>
        <label className="block text-sm font-medium">
          Position ab linkem Auflager (m)
          <input
            className={cn(fieldClassName, errors.position && "border-destructive/60")}
            type="number"
            min={minPosition}
            max={maxPosition}
            step="0.05"
            value={load.positionAlongBeam}
            onChange={(event) =>
              onChange({ ...load, positionAlongBeam: Number(event.target.value) })
            }
          />
          {errors.position ? <p className="mt-2 text-xs text-destructive">{errors.position}</p> : null}
        </label>
        <label className="block text-sm font-medium">
          Gewicht (kg)
          <input
            className={cn(fieldClassName, errors.weight && "border-destructive/60")}
            type="number"
            min="0"
            step="1"
            value={load.weight}
            onChange={(event) => onChange({ ...load, weight: Number(event.target.value) })}
          />
          {errors.weight ? <p className="mt-2 text-xs text-destructive">{errors.weight}</p> : null}
        </label>
        <label className="block text-sm font-medium">
          Kupplung WLL (kg)
          <input
            className={fieldClassName}
            type="number"
            min="0"
            step="10"
            placeholder="Standard"
            value={load.couplerWllKg ?? ""}
            onChange={(event) => {
              const value = event.target.value
              onChange({ ...load, couplerWllKg: value === "" ? undefined : Number(value) })
            }}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">Leer = Standardwert aus Projekt.</p>
        </label>
      </div>
    </div>
  )
}
