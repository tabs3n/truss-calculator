import type { FootType, TerrainCategory, TrussType } from "./types-bridge"

export const COMPANY = {
  name: "Cologne Hunters Licht & Ton Service GmbH",
  address: "Bonner Wall 31, 50677 Koeln",
}

export const DISCLAIMER =
  "Dieses Dokument ist eine Planungsgrundlage und kein gepruefter " +
  "Standsicherheitsnachweis nach den jeweiligen landesrechtlichen Anforderungen. " +
  "Die Verantwortung fuer die korrekte Ausfuehrung liegt beim Betreiber."

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
