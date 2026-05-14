import type { FootType, FrictionPreset, TerrainCategory, TrussType, WindSurface } from "./types-bridge"

export const COMPANY = {
  name: "Cologne Hunters Licht & Ton Service GmbH",
  address: "Bonner Wall 31, 50677 Köln",
}

export const DISCLAIMER =
  "Dieses Dokument ist eine Planungsgrundlage und kein geprüfter " +
  "Standsicherheitsnachweis nach den jeweiligen landesrechtlichen Anforderungen. " +
  "Die Verantwortung für die korrekte Ausführung liegt beim Betreiber."

export const TRUSS_LABELS: Record<TrussType, string> = {
  PROLYTE_H30D: "Prolyte H30D",
  PROLYTE_H30V: "Prolyte H30V",
  PROLYTE_H40V: "Prolyte H40V",
  PROLYTE_S40T: "Prolyte S40T",
  PROLYTE_S52F: "Prolyte S52F",
  EUROTRUSS_TD44: "Eurotruss TD44",
  EUROTRUSS_ST50: "Eurotruss ST50",
  PIPE_48_3_STEEL: "Rohr O48.3 Stahl",
  PIPE_50_3_ALU: "Rohr O50 Alu",
}

export const FOOT_LABELS: Record<FootType, string> = {
  BASEPLATE: "Bodenplatte",
  CONCRETE_BLOCK_1250: "Betonblock 1250 kg",
  TRUSS_PLATE_30x30: "Traversenplatte 30x30",
}

export const TERRAIN_LABELS: Record<TerrainCategory, string> = {
  I: "Kategorie I",
  II: "Kategorie II",
  III: "Kategorie III",
  IV: "Kategorie IV",
}

export const TRUSS_OPTIONS = Object.entries(TRUSS_LABELS).map(([value, label]) => ({
  value: value as TrussType,
  label,
}))

export const FOOT_OPTIONS = Object.entries(FOOT_LABELS).map(([value, label]) => ({
  value: value as FootType,
  label,
}))

export const TERRAIN_OPTIONS = Object.entries(TERRAIN_LABELS).map(([value, label]) => ({
  value: value as TerrainCategory,
  label,
}))

export const WIND_ZONE_OPTIONS = [1, 2, 3, 4] as const

export const WIND_SURFACE_TYPE_LABELS: Record<WindSurface["surfaceType"], string> = {
  LED_WALL: "LED-Wand",
  BANNER_SOLID: "Banner/Plane geschlossen",
  BANNER_MESH: "Meshbanner ~50%",
  BANNER_MESH_OPEN: "Meshbanner offen >70%",
  CUSTOM: "Benutzerdefiniert",
}

export const WIND_SURFACE_TYPE_OPTIONS = [
  { value: "LED_WALL", label: "LED-Wand", dragCoefficient: 1.3 },
  { value: "BANNER_SOLID", label: "Banner/Plane geschlossen", dragCoefficient: 1.3 },
  { value: "BANNER_MESH", label: "Meshbanner ~50%", dragCoefficient: 0.6 },
  { value: "BANNER_MESH_OPEN", label: "Meshbanner offen >70%", dragCoefficient: 0.3 },
  { value: "CUSTOM", label: "Benutzerdefiniert", dragCoefficient: null },
] as const satisfies ReadonlyArray<{
  value: WindSurface["surfaceType"]
  label: string
  dragCoefficient: number | null
}>

export const TRUSS_GATE_FILL_OPTIONS = [
  { value: "LED_WALL", label: "LED-Wand" },
  { value: "BANNER_SOLID", label: "Banner" },
  { value: "BANNER_MESH", label: "Mesh" },
  { value: "BANNER_MESH_OPEN", label: "Mesh offen" },
  { value: "EMPTY", label: "Leer" },
] as const

export const FRICTION_PRESET_DETAILS: Record<
  Exclude<FrictionPreset, "CUSTOM">,
  { label: string; shortLabel: string; value: number; note?: string; tone: string }
> = {
  RUBBER_ON_CONCRETE: {
    label: "Gummi auf Beton",
    shortLabel: "Gummi",
    value: 0.7,
    note: "empfohlen für Gummipads",
    tone: "bg-red-500",
  },
  WOOD_ON_CONCRETE: {
    label: "Holz auf Beton",
    shortLabel: "Holz/Beton",
    value: 0.6,
    tone: "bg-orange-500",
  },
  WOOD_ON_WOOD: {
    label: "Holz auf Holz",
    shortLabel: "Holz/Holz",
    value: 0.4,
    tone: "bg-amber-400",
  },
  WOOD_ON_GRAVEL: {
    label: "Holz auf Kies",
    shortLabel: "Holz/Kies",
    value: 0.65,
    tone: "bg-yellow-500",
  },
  STEEL_ON_CONCRETE: {
    label: "Stahl auf Beton",
    shortLabel: "Stahl/Beton",
    value: 0.2,
    note: "sehr niedrig",
    tone: "bg-sky-500",
  },
  ALU_ON_CONCRETE: {
    label: "Alu auf Beton",
    shortLabel: "Alu/Beton",
    value: 0.2,
    note: "sehr niedrig",
    tone: "bg-blue-500",
  },
  STEEL_ON_STEEL: {
    label: "Stahl auf Stahl",
    shortLabel: "Stahl/Stahl",
    value: 0.1,
    note: "kritisch",
    tone: "bg-slate-900",
  },
  CONCRETE_ON_CONCRETE: {
    label: "Beton auf Beton",
    shortLabel: "Beton/Beton",
    value: 0.5,
    tone: "bg-stone-500",
  },
}

export const FRICTION_PRESET_OPTIONS = [
  "RUBBER_ON_CONCRETE",
  "WOOD_ON_CONCRETE",
  "WOOD_ON_WOOD",
  "WOOD_ON_GRAVEL",
  "STEEL_ON_CONCRETE",
  "ALU_ON_CONCRETE",
  "STEEL_ON_STEEL",
] as const satisfies ReadonlyArray<Exclude<FrictionPreset, "CUSTOM">>

export const WIND_DIRECTION_OPTIONS = [
  { label: "N", angle: 0 },
  { label: "NO", angle: 45 },
  { label: "O", angle: 90 },
  { label: "SO", angle: 135 },
  { label: "S", angle: 180 },
  { label: "SW", angle: 225 },
  { label: "W", angle: 270 },
  { label: "NW", angle: 315 },
] as const

const windDirectionLabels = Object.fromEntries(
  WIND_DIRECTION_OPTIONS.map((direction) => [direction.angle, direction.label]),
) as Record<(typeof WIND_DIRECTION_OPTIONS)[number]["angle"], (typeof WIND_DIRECTION_OPTIONS)[number]["label"]>

export function normalizeWindDirectionAngle(angleDeg: number) {
  return ((angleDeg % 360) + 360) % 360
}

export function getWindDirectionLabel(angleDeg: number) {
  const normalizedAngle = normalizeWindDirectionAngle(angleDeg)

  return windDirectionLabels[normalizedAngle as keyof typeof windDirectionLabels] ?? `${normalizedAngle}°`
}

export function getWindDirectionDisplay(angleDeg: number) {
  const normalizedAngle = normalizeWindDirectionAngle(angleDeg)
  return `${getWindDirectionLabel(normalizedAngle)} (${normalizedAngle}°)`
}

export function compassAngleToVector(angleDeg: number) {
  const radians = (normalizeWindDirectionAngle(angleDeg) * Math.PI) / 180

  return {
    x: Math.sin(radians),
    y: -Math.cos(radians),
  }
}

export function getWindSurfaceTypeDragCoefficient(surfaceType: WindSurface["surfaceType"]) {
  return WIND_SURFACE_TYPE_OPTIONS.find((option) => option.value === surfaceType)?.dragCoefficient ?? null
}

export function getHorizontalLoadStandard(environment: "OUTDOOR" | "INDOOR") {
  return environment === "INDOOR"
    ? "DIN EN 17879: Horizontale Ersatzlasten"
    : "DIN EN 1991-1-4: Windlasten"
}
