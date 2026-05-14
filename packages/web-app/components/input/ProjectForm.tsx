import { useState } from "react"

import { getFrictionCoefficient } from "@truss-calculator/calc-engine"

import { WindCompass } from "@/components/input/WindCompass"
import { Tooltip } from "@/components/ui/Tooltip"
import {
  FRICTION_PRESET_DETAILS,
  FRICTION_PRESET_OPTIONS,
  getHorizontalLoadStandard,
  getWindDirectionDisplay,
  TERRAIN_OPTIONS,
  WIND_ZONE_OPTIONS,
} from "@/lib/constants"
import { TOOLTIP_TEXTS } from "@/lib/tooltip-texts"
import type { FrictionPreset, SnowConfig, SnowExposure, SnowZone, StructureInput, TerrainCategory, WindZone } from "@/lib/types-bridge"
import { cn } from "@/lib/utils"
import { getWindZoneByPlz } from "@/lib/windzones-by-plz"

const fieldClassName =
  "mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none"

const SNOW_ZONE_OPTIONS: SnowZone[] = ["1", "1a", "2", "2a", "3"]
const SNOW_EXPOSURE_OPTIONS: Array<{ value: SnowExposure; label: string }> = [
  { value: "WINDIG", label: "Windig" },
  { value: "NORMAL", label: "Normal" },
  { value: "GESCHUETZT", label: "Geschützt" },
]

const defaultSnowConfig: SnowConfig = {
  enabled: false,
  zone: "1",
  altitudeM: 50,
  roofPitchDeg: 0,
  exposure: "NORMAL",
  roofAreaM2: 0,
}

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

function InlineHint({ text, tone = "muted" }: { text?: string; tone?: "muted" | "danger" | "warning" }) {
  if (!text) return null

  return (
    <p
      className={cn(
        "mt-2 text-xs",
        tone === "danger"
          ? "text-destructive"
          : tone === "warning"
            ? "text-amber-700"
            : "text-muted-foreground",
      )}
    >
      {text}
    </p>
  )
}

function resolveFrictionCoefficient(input: StructureInput) {
  try {
    return getFrictionCoefficient(input.frictionConfig)
  } catch {
    return input.frictionConfig.mode === "CUSTOM" ? input.frictionConfig.customValue ?? 0 : 0
  }
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

  const [plz, setPlz] = useState("")
  const [plzHint, setPlzHint] = useState<{ message: string; tone: "muted" | "warning" | "success" } | null>(null)

  const applyPlz = (value: string) => {
    setPlz(value)
    if (!value.trim()) {
      setPlzHint(null)
      return
    }
    const lookup = getWindZoneByPlz(value)
    if (!lookup) {
      setPlzHint({ message: "Ungültige PLZ — bitte 4–5 Ziffern eingeben.", tone: "warning" })
      return
    }
    const newWindZone = lookup.zone
    if (input.environment !== "INDOOR" && input.windZone !== newWindZone) {
      onChange({ ...input, windZone: newWindZone })
    }
    const baseMsg = `Windzone ${newWindZone}${lookup.note ? ` (${lookup.note})` : ""}`
    setPlzHint({
      message: lookup.exact ? `${baseMsg} – automatisch übernommen.` : `${baseMsg} – Schätzung, ggf. prüfen.`,
      tone: lookup.exact ? "success" : "warning",
    })
  }

  const isIndoor = input.environment === "INDOOR"
  const snowConfig = input.snowConfig ?? defaultSnowConfig
  const frictionCoefficient = resolveFrictionCoefficient(input)
  const frictionError =
    input.frictionConfig.mode === "CUSTOM" && (frictionCoefficient <= 0 || frictionCoefficient > 1)
      ? "Reibungsbeiwert muss zwischen 0 und 1 liegen."
      : ""
  const manualWindDirections =
    input.manualWindDirections && input.manualWindDirections.length > 0 ? input.manualWindDirections : [0]

  const setWindMode = (windMode: "AUTO" | "MANUAL") => {
    onChange({
      ...input,
      windMode,
      manualWindDirections: windMode === "MANUAL" ? manualWindDirections : input.manualWindDirections,
    })
  }

  const setManualWindDirections = (next: number[]) => {
    onChange({
      ...input,
      windMode: "MANUAL",
      manualWindDirections: next.length > 0 ? next : manualWindDirections,
    })
  }

  const setEnvironment = (environment: "INDOOR" | "OUTDOOR") => {
    onChange({
      ...input,
      environment,
      indoorConfig:
        environment === "INDOOR"
          ? {
              doorsCanOpen: input.indoorConfig?.doorsCanOpen ?? false,
            }
          : input.indoorConfig,
    })
  }

  const setDoorsCanOpen = (doorsCanOpen: boolean) => {
    onChange({
      ...input,
      environment: "INDOOR",
      indoorConfig: { doorsCanOpen },
    })
  }

  const updateSnowConfig = (next: SnowConfig) => {
    onChange({
      ...input,
      snowConfig: next,
    })
  }

  const setSnowField = <K extends keyof SnowConfig>(key: K, value: SnowConfig[K]) => {
    updateSnowConfig({
      ...(input.snowConfig ?? defaultSnowConfig),
      [key]: value,
    })
  }

  const setFrictionPreset = (preset: Exclude<FrictionPreset, "CUSTOM">) => {
    onChange({
      ...input,
      frictionConfig: {
        mode: "PRESET",
        preset,
      },
    })
  }

  const setCustomFrictionValue = (customValue: number) => {
    onChange({
      ...input,
      frictionConfig: {
        mode: "CUSTOM",
        customValue,
      },
    })
  }

  const textWarnings = {
    projectName: input.projectName.trim() ? "" : "Projektname fehlt noch.",
    preparedBy: input.preparedBy.trim() ? "" : "Verantwortliche Person eintragen.",
    location: input.location.trim() ? "" : "Standort für die Dokumentation erfassen.",
  }

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Projekt und Standort</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Alle Stammdaten für Bericht, Windannahmen und Reibung.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-[1.5rem] border border-border/80 bg-background/70 p-4">
        <p className="text-sm font-medium">Einsatzumgebung</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setEnvironment("INDOOR")}
            className={cn(
              "rounded-2xl border px-4 py-4 text-left transition-colors",
              isIndoor
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            <span className="block text-base font-semibold">Indoor</span>
            <span className="mt-1 block text-xs opacity-80">Hallenbetrieb mit Ersatzlasten</span>
          </button>

          <button
            type="button"
            onClick={() => setEnvironment("OUTDOOR")}
            className={cn(
              "rounded-2xl border px-4 py-4 text-left transition-colors",
              !isIndoor
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            <span className="block text-base font-semibold">Outdoor</span>
            <span className="mt-1 block text-xs opacity-80">Windlasten für Aussenbetrieb</span>
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-border/70 bg-card/80 p-4 text-sm text-muted-foreground">
          {getHorizontalLoadStandard(input.environment)}
          {isIndoor ? (
            <label className="mt-4 flex items-start gap-3 text-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border"
                checked={input.indoorConfig?.doorsCanOpen ?? false}
                onChange={(event) => setDoorsCanOpen(event.target.checked)}
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  Tore können sich öffnen (Ersatzflächenlast)
                  <Tooltip text={TOOLTIP_TEXTS.indoorDoors}>(?)</Tooltip>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Horizontale Ersatzlasten nach DIN EN 17879
                </span>
              </span>
            </label>
          ) : (
            <p className="mt-2 text-xs">Windlasten nach DIN EN 1991-1-4</p>
          )}
        </div>
      </div>

      {!isIndoor ? (
        <div className="mb-6 rounded-[1.5rem] border border-border/80 bg-background/70 p-4">
          <label className="flex items-start gap-3 text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border"
              checked={snowConfig.enabled}
              onChange={(event) => setSnowField("enabled", event.target.checked)}
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-medium">
                Schneelast berücksichtigen
                <Tooltip text={TOOLTIP_TEXTS.snowLoad}>(?)</Tooltip>
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Optionaler Dach- oder Planenansatz nach DIN EN 1991-1-3.
              </span>
            </span>
          </label>

          {snowConfig.enabled ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="block text-sm font-medium">
                Schneelastzone
                <select
                  className={fieldClassName}
                  value={snowConfig.zone}
                  onChange={(event) => setSnowField("zone", event.target.value as SnowZone)}
                >
                  {SNOW_ZONE_OPTIONS.map((zone) => (
                    <option key={zone} value={zone}>
                      Zone {zone}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Höhe ü. NN (m)
                <input
                  className={fieldClassName}
                  type="number"
                  min="0"
                  max="1500"
                  step="10"
                  value={snowConfig.altitudeM}
                  onChange={(event) => setSnowField("altitudeM", Number(event.target.value))}
                />
              </label>

              <label className="block text-sm font-medium">
                Dachneigung (°)
                <input
                  className={fieldClassName}
                  type="number"
                  min="0"
                  max="90"
                  step="1"
                  value={snowConfig.roofPitchDeg}
                  onChange={(event) => setSnowField("roofPitchDeg", Number(event.target.value))}
                />
              </label>

              <label className="block text-sm font-medium">
                Exposition
                <select
                  className={fieldClassName}
                  value={snowConfig.exposure}
                  onChange={(event) => setSnowField("exposure", event.target.value as SnowExposure)}
                >
                  {SNOW_EXPOSURE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Dachfläche (m²)
                <input
                  className={fieldClassName}
                  type="number"
                  min="0"
                  step="0.1"
                  value={snowConfig.roofAreaM2 ?? 0}
                  onChange={(event) => setSnowField("roofAreaM2", Number(event.target.value))}
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

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
            placeholder="z. B. Köln"
          />
          <InlineHint text={textWarnings.location} tone="danger" />
        </label>

        <label className="block text-sm font-medium">
          PLZ <span className="text-xs font-normal text-muted-foreground">(optional, setzt Windzone automatisch)</span>
          <input
            className={fieldClassName}
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={plz}
            onChange={(event) => applyPlz(event.target.value)}
            placeholder="z. B. 50677"
            disabled={isIndoor}
          />
          {plzHint ? (
            <p
              className={cn(
                "mt-2 text-xs",
                plzHint.tone === "success"
                  ? "text-emerald-700"
                  : plzHint.tone === "warning"
                    ? "text-amber-700"
                    : "text-muted-foreground",
              )}
            >
              {plzHint.message}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Vereinfachte Zuordnung nach DIN EN 1991-1-4/NA Anhang A. Bei Grenzlagen amtliche Quelle prüfen.
            </p>
          )}
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

        <div className="rounded-[1.5rem] border border-border/80 bg-background/60 p-4 md:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-2 text-sm font-medium" title="Werte nach DIN EN 13814 Tabelle 3">
              Untergrund
              <Tooltip text={TOOLTIP_TEXTS.friction}>(?)</Tooltip>
            </p>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
              mu = {frictionCoefficient.toFixed(2)}
            </span>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {FRICTION_PRESET_OPTIONS.map((preset) => {
              const option = FRICTION_PRESET_DETAILS[preset]
              const isSelected =
                input.frictionConfig.mode === "PRESET" && input.frictionConfig.preset === preset

              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setFrictionPreset(preset)}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left transition-colors",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-muted",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("h-3 w-3 rounded-full", isSelected ? "bg-white/90" : option.tone)} />
                    <span className="text-sm font-semibold">{option.label}</span>
                  </span>
                  <span className="mt-1 block text-xs opacity-80">mu = {option.value.toFixed(2)}</span>
                  {option.note ? <span className="mt-1 block text-xs opacity-80">{option.note}</span> : null}
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => setCustomFrictionValue(frictionCoefficient > 0 ? frictionCoefficient : 0.3)}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition-colors",
                input.frictionConfig.mode === "CUSTOM"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              <span className="block text-sm font-semibold">Benutzerdefiniert</span>
              <span className="mt-1 block text-xs opacity-80">Eigener mu-Wert</span>
            </button>
          </div>

          {input.frictionConfig.mode === "CUSTOM" ? (
            <label className="mt-4 block text-sm font-medium">
              <span className="flex items-center gap-2">
                Reibungsbeiwert µ
                <Tooltip text={TOOLTIP_TEXTS.friction}>(?)</Tooltip>
              </span>
              <input
                className={cn(fieldClassName, frictionError && "border-destructive/60")}
                type="number"
                min="0"
                step="0.05"
                value={input.frictionConfig.customValue ?? 0}
                onChange={(event) => setCustomFrictionValue(Number(event.target.value))}
              />
              <InlineHint
                text={frictionError || "Eigener Wert für Sonderfälle."}
                tone={frictionError ? "danger" : "muted"}
              />
            </label>
          ) : null}

          {frictionCoefficient < 0.3 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-800">
              Niedriger Reibwert – mehr Ballast erforderlich!
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          <div
            className={cn(
              "space-y-3 rounded-[1.5rem] border border-border/80 bg-background/60 p-4",
              isIndoor && "opacity-55",
            )}
          >
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                Windzone
                <Tooltip text={TOOLTIP_TEXTS.windZone}>(?)</Tooltip>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isIndoor
                  ? "Im Indoor-Modus für die Ersatzlasten deaktiviert."
                  : "Auswahl 1 bis 4 mit schneller visueller Einordnung."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {WIND_ZONE_OPTIONS.map((zone) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => !isIndoor && setField("windZone", zone)}
                  disabled={isIndoor}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed",
                    input.windZone === zone && !isIndoor
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
              <span className="flex items-center gap-2">
                Geländekategorie
                <Tooltip text={TOOLTIP_TEXTS.terrainCategory}>(?)</Tooltip>
              </span>
              <select
                className={fieldClassName}
                value={input.terrainCategory}
                disabled={isIndoor}
                onChange={(event) => setField("terrainCategory", event.target.value as TerrainCategory)}
              >
                {TERRAIN_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <InlineHint text={isIndoor ? "Im Indoor-Modus ausgeblendet und deaktiviert." : "Kategorie II ist als Startwert vorbelegt."} />
            </label>
          </div>

          <div className="rounded-[1.5rem] border border-border/80 bg-background/60 p-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                Windrichtungen
                <Tooltip text={TOOLTIP_TEXTS.windMode}>(?)</Tooltip>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Automatisch prüft alle Richtungen. Manuell beschränkt den Nachweis auf die
                ausgewaehlten Kompassrichtungen.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWindMode("AUTO")}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left transition-colors",
                  (input.windMode ?? "AUTO") === "AUTO"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                <span className="block text-sm font-semibold">Automatisch</span>
                <span className="mt-1 block text-xs opacity-80">Alle Richtungen</span>
              </button>

              <button
                type="button"
                onClick={() => setWindMode("MANUAL")}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left transition-colors",
                  input.windMode === "MANUAL"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                <span className="block text-sm font-semibold">Manuell</span>
                <span className="mt-1 block text-xs opacity-80">Gezielte Richtungen</span>
              </button>
            </div>

            {input.windMode === "MANUAL" ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr] lg:items-center">
                <WindCompass selectedAngles={manualWindDirections} onChange={setManualWindDirections} />
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Auswahl</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {manualWindDirections.map((angle) => getWindDirectionDisplay(angle)).join(", ")}
                    </p>
                  </div>
                  <InlineHint text="Mindestens eine Richtung bleibt aktiv, damit der Nachweis eindeutig bleibt." />
                </div>
              </div>
            ) : (
              <InlineHint text="Die Berechnung prüft automatisch alle verfuegbaren Windrichtungen." />
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className={cn(isIndoor && "grayscale opacity-45")}>
            <GermanyWindMap activeZone={input.windZone} />
          </div>
          <p className="text-xs text-muted-foreground">
            {isIndoor
              ? "Die Windzonenkarte bleibt als Referenz sichtbar, ist im Indoor-Modus aber deaktiviert."
              : "Vereinfachte Zonenkachel als Auswahlhilfe für die Projektvorbereitung."}
          </p>
        </div>
      </div>
    </section>
  )
}
