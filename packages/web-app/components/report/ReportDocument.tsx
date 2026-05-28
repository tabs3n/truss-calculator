import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"
import { getGoverningIndoorLoad } from "@calc-engine/loads/indoorLoads"
import { getFootProperties, getTrussProperties } from "@calc-engine/materials/database"
import { calculateVariants } from "@calc-engine/variants"
import {
  calculateSurfaceWindForce,
  calculateWindForce,
  getPeakVelocityPressure,
  getRoughnessFactor,
  getRoughnessLength,
  getTerrainFactor,
  getTurbulenceIntensity,
} from "@calc-engine/wind/windLoad"
import { getFrictionCoefficient } from "@truss-calculator/calc-engine"

import { BeamDiagrams } from "@/components/report/BeamDiagrams"
import { IsometricSketch } from "@/components/report/IsometricSketch"
import { PlanView } from "@/components/report/PlanView"
import { VariantsComparison } from "@/components/report/VariantsComparison"
import type { CalculationResult, ReportData, Support, WindZone } from "@/lib/types-bridge"
import {
  FOOT_LABELS,
  getHorizontalLoadStandard,
  getWindDirectionDisplay,
  TERRAIN_LABELS,
  TRUSS_LABELS,
} from "@/lib/constants"

const AIR_DENSITY = 1.25
const BASIC_WIND_VELOCITY: Record<WindZone, number> = {
  1: 22.5,
  2: 25.0,
  3: 27.5,
  4: 30.0,
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    color: "#0f172a",
    fontFamily: "Helvetica",
    lineHeight: 1.45,
  },
  hero: {
    border: "1 solid #cbd5e1",
    borderRadius: 16,
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  h1: {
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  h2: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 10,
  },
  h3: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
  },
  muted: {
    color: "#475569",
  },
  section: {
    marginTop: 18,
  },
  grid2: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  card: {
    flex: 1,
    border: "1 solid #dbe4ee",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#ffffff",
  },
  cardGap: {
    marginLeft: 12,
  },
  table: {
    border: "1 solid #dbe4ee",
    borderRadius: 10,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    borderBottom: "1 solid #e2e8f0",
  },
  rowLast: {
    flexDirection: "row",
  },
  head: {
    backgroundColor: "#e2e8f0",
  },
  cell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  badgeOk: {
    color: "#166534",
    fontWeight: 700,
  },
  badgeWarn: {
    color: "#92400e",
    fontWeight: 700,
  },
  badgeBad: {
    color: "#b91c1c",
    fontWeight: 700,
  },
  disclaimer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff7ed",
    border: "1 solid #fed7aa",
  },
  signature: {
    marginTop: 28,
    paddingTop: 16,
    borderTop: "1 solid #cbd5e1",
  },
  sketchFrame: {
    marginTop: 8,
    border: "1 solid #dbe4ee",
    borderRadius: 12,
    padding: 8,
    backgroundColor: "#f8fafc",
    alignItems: "center",
  },
  keyValueGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
  },
  keyValueItem: {
    width: "50%",
    paddingRight: 12,
    marginBottom: 4,
  },
  formulaCard: {
    border: "1 solid #dbe4ee",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#ffffff",
    marginBottom: 12,
  },
  formulaHeading: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
  },
  formulaLine: {
    fontFamily: "Helvetica",
    fontSize: 9.2,
    marginBottom: 4,
  },
})

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("de-DE")
}

function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "0,00"
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function getOverallStatus(result: CalculationResult) {
  if (result.overallOk) {
    return {
      label: "STANDSICHER",
      style: styles.badgeOk,
      hint: "Alle rechnerischen Nachweise sind erfüllt.",
    }
  }

  if (result.requiredBallastTotalKg > 0.5) {
    return {
      label: "NICHT STANDSICHER",
      style: styles.badgeBad,
      hint: "Für Kippen oder Gleiten ist zusätzlicher Ballast erforderlich.",
    }
  }

  return {
    label: "NACHWEISE PRÜFEN",
    style: styles.badgeWarn,
    hint: "Kein zusätzlicher Ballastbedarf aus Kippen/Gleiten; offene Punkte liegen in Bauteil-, Eingabe- oder Detailnachweisen.",
  }
}

function getSupportLabel(supports: Support[], supportId: string) {
  return supports.find((support) => support.id === supportId)?.label ?? supportId
}

function getTippingAxisLabel(result: CalculationResult, tippingAxisSupportIds: string[]) {
  return tippingAxisSupportIds
    .map((id) => getSupportLabel(result.input.supports, id))
    .join(" - ")
}

function getProjectedReferenceArea(result: CalculationResult) {
  const supportArea = result.input.supports.reduce((sum, support) => sum + 0.4 * support.height, 0)
  const windSurfaceArea = result.input.beams.reduce(
    (sum, beam) =>
      sum +
      beam.windSurfaces.reduce((surfaceSum, surface) => surfaceSum + surface.width * surface.height, 0),
    0,
  )

  return supportArea + windSurfaceArea
}

function getTotalVerticalReactionKN(result: CalculationResult) {
  return result.supports.reduce((sum, support) => sum + support.verticalReactionKN, 0)
}

function getOutdoorDirectionalWindForceKN(result: CalculationResult, angleDeg: number) {
  const qp = result.windLoad.peakVelocityPressure
  const supportWindForceKN = result.input.supports.reduce(
    (sum, support) => sum + calculateWindForce(qp, 0.4, support.height),
    0,
  )
  const surfaceWindForceKN = result.input.beams.reduce(
    (sum, beam) =>
      sum +
      beam.windSurfaces.reduce(
        (surfaceSum, surface) =>
          surfaceSum + calculateSurfaceWindForce(surface, angleDeg, qp),
        0,
      ),
    0,
  )

  return supportWindForceKN + surfaceWindForceKN
}

function compassToMathAngle(compassDeg: number) {
  return (90 - compassDeg + 360) % 360
}

function getEffectiveTippingArmM(support: Support, windMathAngleDeg: number) {
  const footProperties = getFootProperties(support.footType)
  let armXm: number
  let armYm: number

  if (support.footType === "BASEPLATE" && support.outriggerLength !== undefined && support.outriggerLength > 0) {
    armXm = support.outriggerLength
    armYm = support.outriggerLength
  } else {
    armXm = footProperties.tippingArmX / 1000
    armYm = footProperties.tippingArmY / 1000
  }

  const radians = (windMathAngleDeg * Math.PI) / 180
  return Math.abs(armXm * Math.cos(radians) + armYm * Math.sin(radians))
}

function signedDistanceToAxis(
  support: Support,
  axisOrigin: Support,
  normalVector: { x: number; y: number },
) {
  const dx = support.position.x - axisOrigin.position.x
  const dy = support.position.y - axisOrigin.position.y
  return dx * normalVector.x + dy * normalVector.y
}

function buildLeewardNormal(axisSupports: [Support, Support], windMathAngleDeg: number) {
  const axisVector = {
    x: axisSupports[1].position.x - axisSupports[0].position.x,
    y: axisSupports[1].position.y - axisSupports[0].position.y,
  }
  const axisLength = Math.hypot(axisVector.x, axisVector.y)
  const baseNormal =
    axisLength > 0
      ? { x: axisVector.y / axisLength, y: -axisVector.x / axisLength }
      : { x: 1, y: 0 }

  const radians = (windMathAngleDeg * Math.PI) / 180
  const windVector = { x: Math.cos(radians), y: Math.sin(radians) }
  const pointsLeeward = baseNormal.x * windVector.x + baseNormal.y * windVector.y <= 0
  return pointsLeeward ? baseNormal : { x: -baseNormal.x, y: -baseNormal.y }
}

function getHorizontalLoadProof(result: CalculationResult) {
  const maxSupportHeight = Math.max(...result.input.supports.map((support) => support.height), 1)
  const totalVerticalReactionKN = getTotalVerticalReactionKN(result)
  const referenceAreaM2 = getProjectedReferenceArea(result)

  if (result.input.environment === "INDOOR") {
    const indoorLoad = getGoverningIndoorLoad(
      totalVerticalReactionKN,
      maxSupportHeight,
      referenceAreaM2,
      result.input.indoorConfig?.doorsCanOpen ?? false,
    )

    return {
      mode: "INDOOR" as const,
      forceKN: indoorLoad.forceKN,
      applicationHeightM: indoorLoad.applicationHeightM,
      referenceAreaM2,
      indoorLoad,
    }
  }

  const vb = BASIC_WIND_VELOCITY[result.input.windZone]
  const { z0, zMin } = getRoughnessLength(result.input.terrainCategory)
  const zEff = Math.max(result.windLoad.referenceHeight, zMin)
  const kr = getTerrainFactor(z0)
  const cr = getRoughnessFactor(zEff, z0, zMin)
  const vm = cr * vb
  const Iv = getTurbulenceIntensity(zEff, z0, zMin)
  const qp = getPeakVelocityPressure(result.input.windZone, result.input.terrainCategory, result.windLoad.referenceHeight)
  const governingAngleDeg = result.tipping.governingAngleDeg
  const forceKN = getOutdoorDirectionalWindForceKN(result, governingAngleDeg)
  const effectiveCf = qp > 0 && referenceAreaM2 > 0 ? forceKN / (qp * referenceAreaM2) : 0

  return {
    mode: "OUTDOOR" as const,
    forceKN,
    applicationHeightM: result.windLoad.referenceHeight * 0.6,
    referenceAreaM2,
    vb,
    z0,
    zMin,
    zEff,
    kr,
    cr,
    vm,
    Iv,
    qp,
    effectiveCf,
  }
}

function getTippingProof(
  result: CalculationResult,
  horizontalLoadProof: ReturnType<typeof getHorizontalLoadProof>,
) {
  const axisSupports = result.tipping.governing.tippingAxisSupportIds
    .map((id) => result.input.supports.find((support) => support.id === id))
    .filter((support): support is Support => Boolean(support))

  if (axisSupports.length !== 2) {
    return {
      tippingAxisLabel: getTippingAxisLabel(result, result.tipping.governing.tippingAxisSupportIds),
      tippingMomentKNm: 0,
      stabilizingMomentKNm: 0,
      stabilizingVerticalKN: 0,
      effectiveLeverArmM: 0,
    }
  }

  const windMathAngleDeg = compassToMathAngle(result.tipping.governingAngleDeg)
  const normalVector = buildLeewardNormal([axisSupports[0], axisSupports[1]], windMathAngleDeg)
  const windwardTippingArmM = Math.min(
    ...axisSupports.map((support) => getEffectiveTippingArmM(support, windMathAngleDeg)),
  )
  const verticalReactions = new Map(
    result.supports.map((supportResult) => [supportResult.supportId, supportResult.verticalReactionKN]),
  )
  const axisOrigin = axisSupports[0]
  const allStabilizingSupports = result.input.supports
    .map((support) => {
      const isWindward = result.tipping.governing.tippingAxisSupportIds.includes(support.id)
      const baseDistance = isWindward ? 0 : signedDistanceToAxis(support, axisOrigin, normalVector)
      return {
        support,
        leverArmM: baseDistance + windwardTippingArmM,
      }
    })
    .filter((entry) => entry.leverArmM > 0)

  const tippingMomentKNm = horizontalLoadProof.forceKN * horizontalLoadProof.applicationHeightM
  const stabilizingMomentKNm = allStabilizingSupports.reduce((sum, entry) => {
    const verticalReactionKN = Math.max(0, verticalReactions.get(entry.support.id) ?? 0)
    return sum + verticalReactionKN * entry.leverArmM
  }, 0)
  const stabilizingVerticalKN = allStabilizingSupports.reduce((sum, entry) => {
    return sum + Math.max(0, verticalReactions.get(entry.support.id) ?? 0)
  }, 0)
  const effectiveLeverArmM =
    stabilizingVerticalKN > 0 ? stabilizingMomentKNm / stabilizingVerticalKN : 0

  return {
    tippingAxisLabel: getTippingAxisLabel(result, result.tipping.governing.tippingAxisSupportIds),
    tippingMomentKNm,
    stabilizingMomentKNm,
    stabilizingVerticalKN,
    effectiveLeverArmM,
  }
}

function getSlidingProof(
  result: CalculationResult,
  horizontalLoadProof: ReturnType<typeof getHorizontalLoadProof>,
  frictionCoefficient: number,
) {
  let governingAngleDeg = result.tipping.governingAngleDeg
  let resultingHorizontalForceKN = horizontalLoadProof.forceKN

  if (result.input.environment === "OUTDOOR" && result.tipping.directions.length > 0) {
    const maxDirection = result.tipping.directions.reduce((governing, direction) => {
      const forceKN = getOutdoorDirectionalWindForceKN(result, direction.angleDeg)
      const governingForceKN = getOutdoorDirectionalWindForceKN(result, governing.angleDeg)
      return forceKN > governingForceKN ? direction : governing
    })

    governingAngleDeg = maxDirection.angleDeg
    resultingHorizontalForceKN = getOutdoorDirectionalWindForceKN(result, governingAngleDeg)
  }

  const radians = (governingAngleDeg * Math.PI) / 180
  const forceXKN = resultingHorizontalForceKN * Math.sin(radians)
  const forceYKN = resultingHorizontalForceKN * Math.cos(radians)
  const totalVerticalReactionKN = getTotalVerticalReactionKN(result)
  const requiredVerticalDeficitKN = resultingHorizontalForceKN / frictionCoefficient - totalVerticalReactionKN

  return {
    governingAngleDeg,
    forceXKN,
    forceYKN,
    resultingHorizontalForceKN,
    totalVerticalReactionKN,
    requiredVerticalDeficitKN,
  }
}

function Table({
  headers,
  rows,
}: {
  headers: string[]
  rows: Array<string[]>
}) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.head]}>
        {headers.map((header) => (
          <Text key={header} style={styles.cell}>
            {header}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View
          key={`${row.join("-")}-${rowIndex}`}
          style={rowIndex === rows.length - 1 ? styles.rowLast : styles.row}
        >
          {row.map((cell, cellIndex) => (
            <Text key={`${cell}-${cellIndex}`} style={styles.cell}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

export function ReportDocument({ data }: { data: ReportData }) {
  const { result, config } = data
  const frictionCoefficient = getFrictionCoefficient(result.input.frictionConfig)
  const horizontalLoadStandard = getHorizontalLoadStandard(result.input.environment)
  const horizontalLoadProof = getHorizontalLoadProof(result)
  const tippingProof = getTippingProof(result, horizontalLoadProof)
  const slidingProof = getSlidingProof(result, horizontalLoadProof, frictionCoefficient)
  const overallStatus = getOverallStatus(result)
  const variantResults = result.overallOk ? [] : calculateVariants(result.input)

  return (
    <Document title={`Report ${result.input.projectName || "truss-calculator"}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.h1}>{config.companyName}</Text>
          <Text style={[styles.muted, { marginTop: 6 }]}>{config.companyAddress}</Text>
          <Text style={[styles.h2, { marginTop: 24, marginBottom: 6 }]}>
            Planungsreport Truss Calculator
          </Text>
          <Text style={styles.muted}>Projekt: {result.input.projectName || "-"}</Text>
          <Text style={styles.muted}>Event: {result.input.eventName || "-"}</Text>
          <Text style={styles.muted}>Ort: {result.input.location || "-"}</Text>
          <Text style={styles.muted}>Datum: {formatDate(result.input.date)}</Text>
          <Text style={styles.muted}>Verantwortlich: {result.input.preparedBy || config.signatureName}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Ergebnis</Text>
          <View style={styles.grid2}>
            <View style={styles.card}>
              <Text style={styles.muted}>Gesamtstatus</Text>
              <Text style={overallStatus.style}>{overallStatus.label}</Text>
              <Text style={[styles.muted, { marginTop: 4 }]}>{overallStatus.hint}</Text>
            </View>
            <View style={[styles.card, styles.cardGap]}>
              <Text style={styles.muted}>Erforderlicher Zusatzballast gesamt</Text>
              <Text>{formatNumber(result.requiredBallastTotalKg, 0)} kg</Text>
            </View>
          </View>
          <View style={{ marginTop: 12 }}>
            <Text style={styles.muted}>Horizontale Lasten: {horizontalLoadStandard}</Text>
            <Text style={styles.muted}>
              Maßgebender Lastfall: {getWindDirectionDisplay(result.tipping.governingAngleDeg)}
            </Text>
          </View>
        </View>

        <View style={styles.disclaimer}>
          <Text>{config.disclaimer}</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Systemübersicht</Text>
        <View style={styles.card}>
          <Text style={styles.h3}>Standort und System</Text>
          <View style={styles.keyValueGrid}>
            <View style={styles.keyValueItem}>
              <Text>Umgebung: {result.input.environment === "INDOOR" ? "Indoor" : "Outdoor"}</Text>
            </View>
            <View style={styles.keyValueItem}>
              <Text>Norm Horizontallasten: {horizontalLoadStandard}</Text>
            </View>
            <View style={styles.keyValueItem}>
              <Text>Windzone: {result.input.windZone}</Text>
            </View>
            <View style={styles.keyValueItem}>
              <Text>Geländekategorie: {TERRAIN_LABELS[result.input.terrainCategory]}</Text>
            </View>
            <View style={styles.keyValueItem}>
              <Text>Stützen: {result.input.supports.length}</Text>
            </View>
            <View style={styles.keyValueItem}>
              <Text>Traversen: {result.input.beams.length}</Text>
            </View>
            <View style={styles.keyValueItem}>
              <Text>Reibungsbeiwert: {formatNumber(frictionCoefficient)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Table
            headers={["Stütze", "Typ", "Höhe", "Fuß", "Ballast"]}
            rows={result.input.supports.map((support) => [
              support.label,
              TRUSS_LABELS[support.trussType],
              `${formatNumber(support.height)} m`,
              FOOT_LABELS[support.footType],
              `${formatNumber(support.existingBallast, 0)} kg`,
            ])}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.h3}>Punktlasten</Text>
          <Table
            headers={["Traverse", "Element", "Position", "Gewicht"]}
            rows={result.input.beams.flatMap((beam) =>
              beam.loads.map((load) => [
                beam.label,
                load.label,
                `${formatNumber(load.positionAlongBeam)} m`,
                `${formatNumber(load.weight, 0)} kg`,
              ]),
            )}
          />
        </View>

        {result.input.beams.some((beam) => (beam.distributedLoads ?? []).length > 0) ? (
          <View style={styles.section}>
            <Text style={styles.h3}>Streckenlasten</Text>
            <Table
              headers={["Traverse", "Element", "Bereich", "Last"]}
              rows={result.input.beams.flatMap((beam) =>
                (beam.distributedLoads ?? []).map((dl) => [
                  beam.label,
                  dl.label,
                  `${formatNumber(dl.startPositionM)} – ${formatNumber(dl.endPositionM)} m`,
                  `${formatNumber(dl.loadKgPerM, 1)} kg/m`,
                ]),
              )}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <Table
            headers={["Traverse", "Typ", "Stützen", "Punktl.", "Streckenl.", "Windfl."]}
            rows={result.input.beams.map((beam) => {
              const supportIds = beam.supportIds && beam.supportIds.length >= 2
                ? beam.supportIds
                : [beam.startSupportId, beam.endSupportId]
              return [
                beam.label,
                TRUSS_LABELS[beam.trussType],
                `${supportIds.length}`,
                `${beam.loads.length}`,
                `${(beam.distributedLoads ?? []).length}`,
                `${beam.windSurfaces.length}`,
              ]
            })}
          />
        </View>
      </Page>

      {/* ────────── SEITE: Isometrische Skizze (eigene Seite, damit immer rendert) ────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Isometrische Skizze der Konfiguration</Text>
        <Text style={[styles.muted, { fontSize: 10, marginBottom: 12 }]}>
          Stützen, Traversen, Windflächen, Lasten und maßgebende Windrichtung
        </Text>
        <View style={styles.sketchFrame}>
          <IsometricSketch result={result} width={520} height={560} />
        </View>
        <Text style={[styles.muted, { fontSize: 9, marginTop: 10 }]}>
          Maßgebende Windrichtung: {getWindDirectionDisplay(result.tipping.governingAngleDeg)}
        </Text>
      </Page>

      {/* ────────── SEITE: Grundriss (Draufsicht) ────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Grundriss (Draufsicht)</Text>
        <Text style={[styles.muted, { fontSize: 10, marginBottom: 12 }]}>
          Bodenplatten, Stützen, Traversen, alle Windrichtungen — maßgebende Richtung rot fett,
          Kippachse rot gestrichelt verlängert
        </Text>
        <View style={styles.sketchFrame}>
          <PlanView result={result} width={520} height={560} />
        </View>
        <View style={{ marginTop: 12, flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          {result.tipping.directions.map(({ angleDeg, result: directionResult }) => (
            <View
              key={angleDeg}
              style={{
                paddingVertical: 4,
                paddingHorizontal: 8,
                border: "1 solid #e2e8f0",
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 9, color: directionResult.isOk ? "#166534" : "#b91c1c" }}>
                {getWindDirectionDisplay(angleDeg)}: η = {formatNumber(directionResult.utilization)}
                {directionResult.isOk ? " ✓" : " ✗"}
              </Text>
            </View>
          ))}
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Rechnerische Nachweise</Text>

        <View style={styles.section}>
          <View style={styles.formulaCard} wrap={false}>
            <Text style={styles.formulaHeading}>
              {result.input.environment === "INDOOR" ? "Horizontallastberechnung" : "Windlastberechnung"}
            </Text>

            {horizontalLoadProof.mode === "INDOOR" ? (
              <>
                <Text style={styles.formulaLine}>
                  DIN EN 17879, maßgebender Fall: {horizontalLoadProof.indoorLoad.governingCase}
                </Text>
                <Text style={styles.formulaLine}>
                  Imperfektionslast = 0,025 · Fv = 0,025 · {formatNumber(getTotalVerticalReactionKN(result))} = {formatNumber(horizontalLoadProof.indoorLoad.details.imperfectionForceKN)} kN
                </Text>
                <Text style={styles.formulaLine}>
                  Anpralllast = {formatNumber(horizontalLoadProof.indoorLoad.details.impactForceKN)} kN
                </Text>
                <Text style={styles.formulaLine}>
                  Ersatzflächenlast = qh · Aref = {formatNumber(horizontalLoadProof.indoorLoad.details.surfacePressureKNm2)} · {formatNumber(horizontalLoadProof.referenceAreaM2)} = {formatNumber(horizontalLoadProof.indoorLoad.details.surfaceForceKN)} kN
                </Text>
                <Text style={styles.formulaLine}>
                  Fh = {formatNumber(horizontalLoadProof.forceKN)} kN bei h = {formatNumber(horizontalLoadProof.applicationHeightM)} m
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.formulaLine}>
                  Windzone [{result.input.windZone}] → vb = {formatNumber(horizontalLoadProof.vb)} m/s
                </Text>
                <Text style={styles.formulaLine}>
                  Geländekategorie [{result.input.terrainCategory}] → z0 = {formatNumber(horizontalLoadProof.z0)} m
                </Text>
                <Text style={styles.formulaLine}>
                  cr(z) = kr · ln(z/z0) = {formatNumber(horizontalLoadProof.kr)} · ln({formatNumber(horizontalLoadProof.zEff)}/{formatNumber(horizontalLoadProof.z0)}) = {formatNumber(horizontalLoadProof.cr)}
                </Text>
                <Text style={styles.formulaLine}>
                  Iv(z) = 1 / ln(z/z0) = 1 / ln({formatNumber(horizontalLoadProof.zEff)}/{formatNumber(horizontalLoadProof.z0)}) = {formatNumber(horizontalLoadProof.Iv)}
                </Text>
                <Text style={styles.formulaLine}>
                  vm(z) = cr · vb = {formatNumber(horizontalLoadProof.cr)} · {formatNumber(horizontalLoadProof.vb)} = {formatNumber(horizontalLoadProof.vm)} m/s
                </Text>
                <Text style={styles.formulaLine}>
                  qp(z) = (1 + 7·Iv) · 0,5 · ρ · vm² = (1 + 7·{formatNumber(horizontalLoadProof.Iv)}) · 0,5 · {formatNumber(AIR_DENSITY)} · {formatNumber(horizontalLoadProof.vm)}² = {formatNumber(horizontalLoadProof.qp)} kN/m²
                </Text>
                <Text style={styles.formulaLine}>
                  Fw = cf · qp · Aref = {formatNumber(horizontalLoadProof.effectiveCf)} · {formatNumber(horizontalLoadProof.qp)} · {formatNumber(horizontalLoadProof.referenceAreaM2)} = {formatNumber(horizontalLoadProof.forceKN)} kN
                </Text>
              </>
            )}
          </View>

          {result.snowLoad ? (
            <View style={styles.formulaCard} wrap={false}>
              <Text style={styles.formulaHeading}>Schneelast (DIN EN 1991-1-3)</Text>
              <Text style={styles.formulaLine}>
                s = μ · C_e · C_t · s_k = {formatNumber(result.snowLoad.shapeFactor)} · {formatNumber(result.snowLoad.exposureFactor)} · {formatNumber(result.snowLoad.thermalFactor)} · {formatNumber(result.snowLoad.characteristicGroundLoadKNm2)} = {formatNumber(result.snowLoad.roofLoadKNm2)} kN/m²
              </Text>
              <Text style={styles.formulaLine}>
                F_s,k = s · A = {formatNumber(result.snowLoad.roofLoadKNm2)} · {formatNumber(result.snowLoad.roofAreaM2)} = {formatNumber(result.snowLoad.totalCharacteristicLoadKN)} kN
              </Text>
              <Text style={styles.formulaLine}>
                F_s,d = F_s,k · γQ · Dyn = {formatNumber(result.snowLoad.totalCharacteristicLoadKN)} · {formatNumber(result.designFactors.gammaQ)} · {formatNumber(result.designFactors.dynamicFactor)} = {formatNumber(result.snowLoad.totalDesignLoadKN)} kN
              </Text>
            </View>
          ) : null}

          <View style={styles.formulaCard} wrap={false}>
            <Text style={styles.formulaHeading}>Kippsicherheitsnachweis (EQU, DIN EN 1990)</Text>
            <Text style={styles.formulaLine}>
              Maßgebende Windrichtung: {formatNumber(result.tipping.governingAngleDeg, 0)}°
            </Text>
            <Text style={styles.formulaLine}>Kippachse: {tippingProof.tippingAxisLabel}</Text>
            <Text style={styles.formulaLine}>
              Faktoren: γQ = {formatNumber(result.designFactors.gammaQ)}, Dyn = {formatNumber(result.designFactors.dynamicFactor)}, γG,inf = {formatNumber(result.designFactors.gammaGinf)}
            </Text>
            <Text style={styles.formulaLine}>
              Fw,d = Fw,k · γQ · Dyn = {formatNumber(horizontalLoadProof.forceKN)} · {formatNumber(result.designFactors.horizontalDesignFactor)} = {formatNumber(result.tipping.governing.designHorizontalForceKN)} kN
            </Text>
            <Text style={styles.formulaLine}>
              Mk,d = Fw,d · h = {formatNumber(result.tipping.governing.designHorizontalForceKN)} kN · {formatNumber(result.tipping.governing.applicationHeightM)} m = {formatNumber(result.tipping.governing.designTippingMomentKNm)} kN·m
            </Text>
            <Text style={styles.formulaLine}>
              Ms,d = Σ(Rz,EQU · a) = {formatNumber(result.tipping.governing.totalEquVerticalReactionKN)} kN · {formatNumber(result.tipping.governing.effectiveLeverArmM)} m = {formatNumber(result.tipping.governing.designStabilizingMomentKNm)} kN·m
            </Text>
            <Text style={styles.formulaLine}>
              Ausnutzung: η = Mk,d / Ms,d = {formatNumber(result.tipping.governing.designTippingMomentKNm)} / {formatNumber(result.tipping.governing.designStabilizingMomentKNm)} = {formatNumber(result.tipping.governing.utilization)} {result.tipping.governing.utilization <= 1 ? "≤ 1,0 OK" : "> 1,0 NICHT OK"}
            </Text>
            <Text style={styles.formulaLine}>
              Erf. Ballast = (Mk,d − Ms,d) / (g · a) = ({formatNumber(result.tipping.governing.designTippingMomentKNm)} − {formatNumber(result.tipping.governing.designStabilizingMomentKNm)}) / (9,81 · {formatNumber(result.tipping.governing.effectiveLeverArmM)}) = {formatNumber(result.tipping.governing.requiredBallastTotalKg, 0)} kg
            </Text>
          </View>

          <View style={styles.formulaCard} wrap={false}>
            <Text style={styles.formulaHeading}>Gleitnachweis (DIN EN 13814)</Text>
            <Text style={styles.formulaLine}>
              Fh,d = {formatNumber(result.sliding.resultingHorizontalForceKN)} kN (Bemessungswert, maßgebende Richtung)
            </Text>
            <Text style={styles.formulaLine}>
              Fv,EQU = {formatNumber(result.tipping.governing.totalEquVerticalReactionKN)} kN (γG,inf = {formatNumber(result.designFactors.gammaGinf)})
            </Text>
            <Text style={styles.formulaLine}>
              µ = {formatNumber(frictionCoefficient)} (Reibbeiwert)
            </Text>
            <Text style={styles.formulaLine}>
              Erf. Ballast = Fh,d/µ − Fv,EQU = {formatNumber(result.sliding.resultingHorizontalForceKN)}/{formatNumber(frictionCoefficient)} − {formatNumber(result.tipping.governing.totalEquVerticalReactionKN)} = {formatNumber(Math.max(0, result.sliding.requiredBallastKg) * 9.81 / 1000)} kN ≙ {formatNumber(Math.max(0, result.sliding.requiredBallastKg), 0)} kg {result.sliding.isOk ? "(OK, kein Zusatzballast)" : ""}
            </Text>
          </View>

          {result.beams.map((beamResult) => {
            const beamInput = result.input.beams.find((beam) => beam.id === beamResult.beamId)
            const trussType = beamInput?.trussType
            const trussProperties = trussType ? getTrussProperties(trussType) : null
            const beamLabel = beamInput?.label ?? beamResult.beamId

            return (
              <View key={beamResult.beamId} style={styles.formulaCard} wrap={false}>
                <Text style={styles.formulaHeading}>Biegemomentnachweis: {beamLabel}</Text>
                <Text style={styles.formulaLine}>
                  MEd = {formatNumber(beamResult.maxBendingMomentKNm)} kN·m
                </Text>
                <Text style={styles.formulaLine}>
                  MRd = {formatNumber(trussProperties?.bendingResistanceY ?? 0)} kN·m (aus Systemstatik {trussType ? TRUSS_LABELS[trussType] : beamResult.beamId})
                </Text>
                <Text style={styles.formulaLine}>
                  η = MEd/MRd = {formatNumber(beamResult.maxBendingMomentKNm)}/{formatNumber(trussProperties?.bendingResistanceY ?? 0)} = {formatNumber(beamResult.bendingUtilization)} {beamResult.bendingUtilization <= 1 ? "≤ 1,0 OK" : "> 1,0 NICHT OK"}
                </Text>
              </View>
            )
          })}
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Nachweise</Text>

        <View style={styles.section}>
          <Text style={styles.h3}>Traversen</Text>
          <Table
            headers={["Traverse", "M_max", "V_max", "η Biegung", "η Quer", "OK"]}
            rows={result.beams.map((beam) => [
              result.input.beams.find((entry) => entry.id === beam.beamId)?.label ?? beam.beamId,
              `${formatNumber(beam.maxBendingMomentKNm)} kNm`,
              `${formatNumber(beam.maxShearForceKN)} kN`,
              formatNumber(beam.bendingUtilization),
              formatNumber(beam.shearUtilization),
              beam.isOk ? "Ja" : "Nein",
            ])}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.h3}>Stützen / Knicken</Text>
          <Table
            headers={["Stütze", "Rz", "Rx", "Ry", "η Knicken", "OK"]}
            rows={result.supports.map((support) => [
              result.input.supports.find((entry) => entry.id === support.supportId)?.label ?? support.supportId,
              `${formatNumber(support.verticalReactionKN)} kN`,
              `${formatNumber(support.horizontalReactionXKN)} kN`,
              `${formatNumber(support.horizontalReactionYKN)} kN`,
              formatNumber(support.bucklingUtilization),
              support.isOk ? "Ja" : "Nein",
            ])}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.h3}>Kippen / Gleiten</Text>
          <Table
            headers={["Richtung", "Kippachse", "η", "Rz,min", "Ballast", "OK"]}
            rows={[
              ...result.tipping.directions.map(({ angleDeg, result: directionResult }) => [
                getWindDirectionDisplay(angleDeg),
                getTippingAxisLabel(result, directionResult.tippingAxisSupportIds),
                formatNumber(directionResult.utilization),
                `${formatNumber(directionResult.minVerticalReactionKN)} kN`,
                `${formatNumber(directionResult.requiredBallastTotalKg, 0)} kg`,
                directionResult.isOk ? "Ja" : "Nein",
              ]),
              [
                "Gleiten",
                "-",
                "-",
                `${formatNumber(result.sliding.resultingHorizontalForceKN)} kN`,
                `${formatNumber(Math.max(0, result.sliding.requiredBallastKg), 0)} kg`,
                result.sliding.isOk ? "Ja" : "Nein",
              ],
            ]}
          />
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Schnittkraftverläufe je Traverse</Text>
        <Text style={[styles.muted, { fontSize: 10, marginBottom: 12 }]}>
          Bemessungswerte aus dem jeweils maßgebenden Segment: Biegemoment M, Querkraft V und Biegelinie w.
        </Text>

        {result.beams.length > 0 ? (
          result.beams.map((beamResult) => {
            const beamInput = result.input.beams.find((beam) => beam.id === beamResult.beamId)
            return (
              <BeamDiagrams
                key={beamResult.beamId}
                beam={beamResult}
                beamLabel={beamInput?.label ?? beamResult.beamId}
              />
            )
          })
        ) : (
          <Text style={styles.muted}>Keine Traversennachweise vorhanden.</Text>
        )}
      </Page>

      {variantResults.length > 0 ? (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h2}>Optimierungspotenzial</Text>
          <Text style={[styles.muted, { fontSize: 10, marginBottom: 12 }]}>
            Variantenrechnung mit unveränderter Geometrie, aber angepassten Fußsystemen, Reibwerten oder Windflächen.
          </Text>
          <VariantsComparison baseline={result} variants={variantResults} />
        </Page>
      ) : null}

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Ballast und Normen</Text>

        <View style={styles.section}>
          <Table
            headers={["Stütze", "Vorhanden", "Zusatzbedarf", "Nach Ergänzung"]}
            rows={result.ballastPerSupport.map((entry) => [
              entry.supportLabel,
              `${formatNumber(entry.existingBallastKg, 0)} kg`,
              `${formatNumber(entry.additionalBallastNeededKg, 0)} kg`,
              `${formatNumber(entry.existingBallastKg + entry.additionalBallastNeededKg, 0)} kg`,
            ])}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.h3}>Normverweise</Text>
          {result.normReferences.map((reference) => (
            <Text key={reference} style={{ marginBottom: 4 }}>
              {reference}
            </Text>
          ))}
        </View>

        <View style={styles.signature}>
          <Text>Unterschrift</Text>
          <View style={{ marginTop: 6, width: 240, borderTop: "1 solid #64748b" }} />
          <Text style={{ marginTop: 18 }}>{config.signatureName}</Text>
        </View>
      </Page>
    </Document>
  )
}
