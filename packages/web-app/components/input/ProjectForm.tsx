import { WIND_ZONE_OPTIONS, TERRAIN_OPTIONS } from "@/lib/constants"
import type { StructureInput, TerrainCategory, WindZone } from "@/lib/types-bridge"
import { cn } from "@/lib/utils"

const fieldClassName =
  "mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none"

function GermanyWindMap({ activeZone }: { activeZone: WindZone }) {
  const fills: Record<WindZone, string> = {
    1: activeZone === 1 ? "fill-primary/90" : "fill-muted",
    2: activeZone === 2 ? "fill-primary/80" : "fill-muted/80",
    3: activeZone === 3 ? "fill-primary/70" : "fill-muted/60",
    4: activeZone === 4 ? "fill-primary/60" : "fill-muted/40",
  }

  return (
    <svg viewBox="0 0 180 240" className="h-36 w-full rounded-2xl border border-border bg-card p-3">
      <defs>
        <clipPath id="germany-shape">
          <path d="M88 7 106 22 121 23 133 40 148 49 146 66 158 81 149 96 157 110 147 131 154 149 136 160 132 178 115 193 105 214 89 220 79 211 61 207 47 190 30 188 26 169 16 154 23 139 17 123 31 112 36 92 29 74 41 57 56 54 67 36 81 31Z" />
        </clipPath>
      </defs>

      <path
        d="M88 7 106 22 121 23 133 40 148 49 146 66 158 81 149 96 157 110 147 131 154 149 136 160 132 178 115 193 105 214 89 220 79 211 61 207 47 190 30 188 26 169 16 154 23 139 17 123 31 112 36 92 29 74 41 57 56 54 67 36 81 31Z"
        className="fill-background stroke-border stroke-[6]"
      />
      <g clipPath="url(#germany-shape)">
        <rect x="10" y="8" width="160" height="72" className={fills[1]} />
        <rect x="10" y="80" width="160" height="52" className={fills[2]} />
        <rect x="10" y="132" width="160" height="44" className={fills[3]} />
        <rect x="10" y="176" width="160" height="52" className={fills[4]} />
      </g>
      <g className="fill-foreground text-[14px] font-semibold">
        <text x="86" y="52" textAnchor="middle">
          1
        </text>
        <text x="86" y="108" textAnchor="middle">
          2
        </text>
        <text x="86" y="154" textAnchor="middle">
          3
        </text>
        <text x="86" y="204" textAnchor="middle">
          4
        </text>
      </g>
    </svg>
  )
}

function InlineHint({ text, tone = "muted" }: { text?: string; tone?: "muted" | "danger" }) {
  if (!text) return null

  return (
    <p className={cn("mt-2 text-xs", tone === "danger" ? "text-destructive" : "text-muted-foreground")}>
      {text}
    </p>
  )
}

export function ProjectForm({
  input,
  onChange,
}: {
  input: StructureInput
  onChange: (next: StructureInput) => void
}) {
  const setField = <K extends keyof StructureInput>(key: K, value: StructureInput[K]) => {
    onChange({ ...input, [key]: value })
  }

  const textWarnings = {
    projectName: input.projectName.trim() ? "" : "Projektname fehlt noch.",
    preparedBy: input.preparedBy.trim() ? "" : "Verantwortliche Person eintragen.",
    location: input.location.trim() ? "" : "Standort fuer die Dokumentation erfassen.",
  }

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Projekt und Standort</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Alle Stammdaten fuer Bericht, Windannahmen und Reibung.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium">
          Projektname
          <input
            className={cn(fieldClassName, textWarnings.projectName && "border-destructive/60")}
            value={input.projectName}
            onChange={(event) => setField("projectName", event.target.value)}
            placeholder="z. B. Open Air 2026"
          />
          <InlineHint text={textWarnings.projectName} tone="danger" />
        </label>

        <label className="block text-sm font-medium">
          Eventname
          <input
            className={fieldClassName}
            value={input.eventName}
            onChange={(event) => setField("eventName", event.target.value)}
            placeholder="z. B. Buehnenkopf Nord"
          />
        </label>

        <label className="block text-sm font-medium">
          Ort
          <input
            className={cn(fieldClassName, textWarnings.location && "border-destructive/60")}
            value={input.location}
            onChange={(event) => setField("location", event.target.value)}
            placeholder="z. B. Koeln"
          />
          <InlineHint text={textWarnings.location} tone="danger" />
        </label>

        <label className="block text-sm font-medium">
          Datum
          <input
            className={fieldClassName}
            type="date"
            value={input.date}
            onChange={(event) => setField("date", event.target.value)}
          />
        </label>

        <label className="block text-sm font-medium">
          Verantwortliche Person
          <input
            className={cn(fieldClassName, textWarnings.preparedBy && "border-destructive/60")}
            value={input.preparedBy}
            onChange={(event) => setField("preparedBy", event.target.value)}
            placeholder="Name der Fachkraft"
          />
          <InlineHint text={textWarnings.preparedBy} tone="danger" />
        </label>

        <label className="block text-sm font-medium">
          Reibungsbeiwert mu
          <input
            className={cn(
              fieldClassName,
              input.frictionCoefficient <= 0 && "border-destructive/60",
            )}
            type="number"
            min="0"
            step="0.05"
            value={input.frictionCoefficient}
            onChange={(event) => setField("frictionCoefficient", Number(event.target.value))}
          />
          <InlineHint
            text={input.frictionCoefficient <= 0 ? "Reibungsbeiwert muss groesser als 0 sein." : "Standardwert 0.30 konservativ nach Vorgabe."}
            tone={input.frictionCoefficient <= 0 ? "danger" : "muted"}
          />
        </label>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Windzone</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Auswahl 1 bis 4 mit schneller visueller Einordnung.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {WIND_ZONE_OPTIONS.map((zone) => (
              <button
                key={zone}
                type="button"
                onClick={() => setField("windZone", zone)}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left transition-colors",
                  input.windZone === zone
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                <span className="block text-xs uppercase tracking-[0.18em] opacity-80">Zone</span>
                <span className="mt-1 block text-xl font-semibold">{zone}</span>
              </button>
            ))}
          </div>

          <label className="block text-sm font-medium">
            Gelaendekategorie
            <select
              className={fieldClassName}
              value={input.terrainCategory}
              onChange={(event) => setField("terrainCategory", event.target.value as TerrainCategory)}
            >
              {TERRAIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <InlineHint text="Kategorie II ist als Startwert vorbelegt." />
          </label>
        </div>

        <div className="space-y-3">
          <GermanyWindMap activeZone={input.windZone} />
          <p className="text-xs text-muted-foreground">
            Vereinfachte Zonenkachel als Auswahlhilfe fuer die Projektvorbereitung.
          </p>
        </div>
      </div>
    </section>
  )
}
