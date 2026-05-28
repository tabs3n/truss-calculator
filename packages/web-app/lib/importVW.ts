import { defaultInput } from "./defaultInput"
import type { FootType, StructureInput, TrussType, VWExportData } from "./types-bridge"

const TRUSS_FALLBACK: TrussType = "PROLYTE_H30V"
const FOOT_FALLBACK: FootType = "BASEPLATE"

const trussAliases: Record<string, TrussType> = {
  PROLYTE_H30D: "PROLYTE_H30D",
  H30D: "PROLYTE_H30D",
  PROLYTE_H30V: "PROLYTE_H30V",
  H30V: "PROLYTE_H30V",
  PROLYTE_H40V: "PROLYTE_H40V",
  H40V: "PROLYTE_H40V",
  PROLYTE_S40T: "PROLYTE_S40T",
  S40T: "PROLYTE_S40T",
  PROLYTE_S52F: "PROLYTE_S52F",
  S52F: "PROLYTE_S52F",
  EUROTRUSS_TD44: "EUROTRUSS_TD44",
  TD44: "EUROTRUSS_TD44",
  EUROTRUSS_ST50: "EUROTRUSS_ST50",
  ST50: "EUROTRUSS_ST50",
  PIPE_48_3_STEEL: "PIPE_48_3_STEEL",
  PIPE48_3_STEEL: "PIPE_48_3_STEEL",
  PIPE_50_3_ALU: "PIPE_50_3_ALU",
  PIPE50_3_ALU: "PIPE_50_3_ALU",
}

const footAliases: Record<string, FootType> = {
  BASEPLATE: "BASEPLATE",
  BASE_PLATE: "BASEPLATE",
  BODENPLATTE: "BASEPLATE",
  CONCRETE_BLOCK_1250: "CONCRETE_BLOCK_1250",
  BETONBLOCK_1250: "CONCRETE_BLOCK_1250",
  BLOCK_1250: "CONCRETE_BLOCK_1250",
  TRUSS_PLATE_30X30: "TRUSS_PLATE_30x30",
  TRUSS_PLATE_30X30_CM: "TRUSS_PLATE_30x30",
  TRUSS_PLATE_30X30M: "TRUSS_PLATE_30x30",
  TRAVERSENPLATTE_30X30: "TRUSS_PLATE_30x30",
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^\w]+/g, "_")
    .replace(/_+/g, "_")
}

function mapTrussType(value: string, warnings: string[]): TrussType {
  const normalized = normalizeKey(value)
  const mapped = trussAliases[normalized]
  if (mapped) return mapped

  warnings.push(`Unbekannter Traversentyp "${value}" wurde auf ${TRUSS_FALLBACK} gesetzt.`)
  return TRUSS_FALLBACK
}

function mapFootType(value: string, warnings: string[]): FootType {
  const normalized = normalizeKey(value)
  const mapped = footAliases[normalized]
  if (mapped) return mapped

  warnings.push(`Unbekannter Fuss-Typ "${value}" wurde auf ${FOOT_FALLBACK} gesetzt.`)
  return FOOT_FALLBACK
}

function mmToM(value: number) {
  return value / 1000
}

function assertVWExportData(data: VWExportData) {
  if (!data || data.exportVersion !== "1.0") {
    throw new Error("VW-Import erwartet exportVersion 1.0.")
  }

  if (!Array.isArray(data.supports) || !Array.isArray(data.beams)) {
    throw new Error("VW-Import enthaelt keine gueltigen supports/beams Arrays.")
  }
}

export function importFromVW(data: VWExportData): StructureInput {
  assertVWExportData(data)

  const warnings: string[] = []

  const supports = data.supports.map((support, index) => ({
    id: support.id,
    label: support.label || `Stütze ${index + 1}`,
    position: {
      x: mmToM(support.x),
      y: mmToM(support.y),
    },
    height: mmToM(support.height),
    trussType: mapTrussType(support.trussType, warnings),
    footType: mapFootType(support.footType, warnings),
    baseplateSize: 0.6,
    outriggerLength: 0,
    existingBallast: 0,
    // numberOfConcreteBlocks wird im UI nachträglich gesetzt; hier ignoriert
  }))

  const supportIds = new Set(supports.map((support) => support.id))

  const beams = data.beams
    .map((beam, originalIndex) => ({ beam, originalIndex }))
    .filter(({ beam }) => {
      const valid = supportIds.has(beam.startId) && supportIds.has(beam.endId)
      if (!valid) {
        warnings.push(`Traverse "${beam.label || beam.id}" wurde uebersprungen, weil Start- oder Endstuetze fehlt.`)
      }
      return valid
    })
    .map(({ beam, originalIndex }) => ({
      id: beam.id,
      label: beam.label || `Traverse ${originalIndex + 1}`,
      startSupportId: beam.startId,
      endSupportId: beam.endId,
      // Zwischenstützen aus supportIds (ohne Start/End) ableiten
      ...(beam.supportIds && beam.supportIds.length > 2
        ? { additionalSupportIds: beam.supportIds.slice(1, -1).filter((id) => supportIds.has(id)) }
        : {}),
      trussType: mapTrussType(beam.trussType, warnings),
      ...(typeof beam.mountHeight === "number" ? { mountHeightM: mmToM(beam.mountHeight) } : {}),
      cantileverStart: mmToM(beam.cantileverStart),
      cantileverEnd: mmToM(beam.cantileverEnd),
      loads: beam.loads.map((load, loadIndex) => ({
        id: `${beam.id}-load-${loadIndex + 1}`,
        label: load.label || `Last ${loadIndex + 1}`,
        positionAlongBeam: mmToM(load.positionMm),
        weight: load.weightKg,
      })),
      distributedLoads: (beam.distributedLoads ?? []).map((dl, dlIndex) => ({
        id: `${beam.id}-dl-${dlIndex + 1}`,
        label: dl.label || `Streckenlast ${dlIndex + 1}`,
        startPositionM: mmToM(dl.startPositionMm),
        endPositionM: mmToM(dl.endPositionMm),
        loadKgPerM: dl.loadKgPerM,
      })),
      windSurfaces: [],
    }))

  if (warnings.length > 0) {
    console.warn("VW-Import Warnungen:", warnings)
  }

  return {
    ...defaultInput,
    supports,
    beams,
  }
}
