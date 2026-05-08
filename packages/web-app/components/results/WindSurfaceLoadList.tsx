import { getWindDirectionDisplay } from "@/lib/constants"
import { getWindSurfaceLoadEntries } from "@/lib/wind-surface-results"
import type { CalculationResult } from "@/lib/types-bridge"

export function WindSurfaceLoadList({
  result,
  beamId,
  title,
}: {
  result: CalculationResult
  beamId?: string
  title?: string
}) {
  const entries = getWindSurfaceLoadEntries(result, { beamId })
  const hasConfiguredSurfaces = beamId
    ? (result.input.beams.find((beam) => beam.id === beamId)?.windSurfaces.length ?? 0) > 0
    : result.input.beams.some((beam) => beam.windSurfaces.length > 0)

  if (!hasConfiguredSurfaces) return null

  if (result.input.environment === "INDOOR") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-800">
        {title ? <p className="font-semibold">{title}</p> : null}
        <p className={title ? "mt-1" : undefined}>
          Im Indoor-Modus werden horizontale Ersatzlasten nach DIN EN 17879 angesetzt, keine
          richtungsabhaengigen Windlasten je Windflaeche.
        </p>
      </div>
    )
  }

  if (entries.length === 0) return null

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
      {title ? <p className="text-sm font-semibold text-slate-900">{title}</p> : null}
      <ul className={title ? "mt-2 space-y-2 text-sm text-slate-700" : "space-y-2 text-sm text-slate-700"}>
        {entries.map((entry) => (
          <li key={`${entry.beamId}-${entry.surfaceId}`}>
            <span className="font-medium">{entry.surfaceLabel}</span>
            {!beamId ? <span className="text-muted-foreground"> auf {entry.beamLabel}</span> : null}
            : Windlast bei massgebendem Lastfall: {entry.forceKN.toFixed(2)} kN (cf=
            {entry.dragCoefficient.toFixed(2)}, Richtung {getWindDirectionDisplay(entry.directionAngleDeg)})
          </li>
        ))}
      </ul>
    </div>
  )
}
