import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"
import { getGoverningIndoorLoad } from "@calc-engine/loads/indoorLoads"
import { getFootProperties, getTrussProperties } from "@calc-engine/materials/database"
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

import { IsometricSketch } from "@/components/report/IsometricSketch"
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
    fontSize: 24,
    fontWeight: 700,
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
    fontFamily: "Courier",
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
              <Text style={result.overallOk ? styles.badgeOk : styles.badgeBad}>
                {result.overallOk ? "STANDSICHER" : "NICHT STANDSICHER"}
              </Text>
            </View>
            <View style={[styles.card, styles.cardGap]}>
              <Text style={styles.muted}>Erforderlicher Ballast gesamt</Text>
              <Text>{formatNumber(result.requiredBallastTotalKg, 0)} kg</Text>
            </View>
          </View>
          <View style={{ marginTop: 12 }}>
            <Text style={styles.muted}>Horizontale Lasten: {horizontalLoadStandard}</Text>
            <Text style={styles.muted}>
              Massgebender Lastfall: {getWindDirectionDisplay(result.tipping.governingAngleDeg)}
            </Text>
          </View>
        </View>

        <View style={styles.disclaimer}>
          <Text>{config.disclaimer}</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Systemuebersicht</Text>
        <View style={styles.grid2}>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.h3}>Standort und System</Text>
            <Text>Umgebung: {result.input.environment === "INDOOR" ? "Indoor" : "Outdoor"}</Text>
            <Text>Norm Horizontallasten: {horizontalLoadStandard}</Text>
            <Text>Windzone: {result.input.windZone}</Text>
            <Text>Gelaendekategorie: {TERRAIN_LABELS[result.input.terrainCategory]}</Text>
            <Text>Stuetzen: {result.input.supports.length}</Text>
            <Text>Traversen: {result.input.beams.length}</Text>
            <Text>Reibungsbeiwert: {formatNumber(frictionCoefficient)}</Text>
          </View>
          <View style={[styles.card, styles.cardGap, { flex: 1.15 }]}>
            <Text style={styles.h3}>Isometrische Skizze</Text>
            <View style={styles.sketchFrame}>
              <IsometricSketch result={result} width={340} height={227} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Table
            headers={["Stuetze", "Typ", "Hoehe", "Fuss", "Ballast"]}
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
          <Text style={styles.h3}>Lasten</Text>
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

        <View style={styles.section}>
          <Table
            headers={["Traverse", "Typ", "Lasten", "Windflaechen"]}
            rows={result.input.beams.map((beam) => [
              beam.label,
              TRUSS_LABELS[beam.trussType],
              `${beam.loads.length}`,
              `${beam.windSurfaces.length}`,
            ])}
          />
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Rechnerische Nachweise</Text>

        <View style={styles.section}>
          <View style={styles.formulaCard}>
            <Text style={styles.formulaHeading}>
              {result.input.environment === "INDOOR" ? "Horizontallastberechnung" : "Windlastberechnung"}
            </Text>

            {horizontalLoadProof.mode === "INDOOR" ? (
              <>
                <Text style={styles.formulaLine}>
                  DIN EN 17879, massgebender Fall: {horizontalLoadProof.indoorLoad.governingCase}
                </Text>
                <Text style={styles.formulaLine}>
                  Imperfektionslast = 0,025 x Fv = 0,025 x {formatNumber(getTotalVerticalReactionKN(result))} = {formatNumber(horizontalLoadProof.indoorLoad.details.imperfectionForceKN)} kN
                </Text>
                <Text style={styles.formulaLine}>
                  Anpralllast = {formatNumber(horizontalLoadProof.indoorLoad.details.impactForceKN)} kN
                </Text>
                <Text style={styles.formulaLine}>
                  Ersatzflaechenlast = qh x Aref = {formatNumber(horizontalLoadProof.indoorLoad.details.surfacePressureKNm2)} x {formatNumber(horizontalLoadProof.referenceAreaM2)} = {formatNumber(horizontalLoadProof.indoorLoad.details.surfaceForceKN)} kN
                </Text>
                <Text style={styles.formulaLine}>
                  Fh = {formatNumber(horizontalLoadProof.forceKN)} kN bei h = {formatNumber(horizontalLoadProof.applicationHeightM)} m
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.formulaLine}>
                  Windzone [{result.input.windZone}] -&gt; vb = {formatNumber(horizontalLoadProof.vb)} m/s
                </Text>
                <Text style={styles.formulaLine}>
                  Gelaendekategorie [{result.input.terrainCategory}] -&gt; z0 = {formatNumber(horizontalLoadProof.z0)} m
                </Text>
                <Text style={styles.formulaLine}>
                  cr(z) = kr x ln(z/z0) = {formatNumber(horizontalLoadProof.kr)} x ln({formatNumber(horizontalLoadProof.zEff)}/{formatNumber(horizontalLoadProof.z0)}) = {formatNumber(horizontalLoadProof.cr)}
                </Text>
                <Text style={styles.formulaLine}>
                  Iv(z) = 1 / ln(z/z0) = 1 / ln({formatNumber(horizontalLoadProof.zEff)}/{formatNumber(horizontalLoadProof.z0)}) = {formatNumber(horizontalLoadProof.Iv)}
                </Text>
                <Text style={styles.formulaLine}>
                  vm(z) = cr x vb = {formatNumber(horizontalLoadProof.cr)} x {formatNumber(horizontalLoadProof.vb)} = {formatNumber(horizontalLoadProof.vm)} m/s
                </Text>
                <Text style={styles.formulaLine}>
                  qp(z) = (1 + 7xIv) x 0,5 x rho x vm^2 = (1 + 7x{formatNumber(horizontalLoadProof.Iv)}) x 0,5 x {formatNumber(AIR_DENSITY)} x {formatNumber(horizontalLoadProof.vm)}^2 = {formatNumber(horizontalLoadProof.qp)} kN/m^2
                </Text>
                <Text style={styles.formulaLine}>
                  Fw = cf x qp x Aref = {formatNumber(horizontalLoadProof.effectiveCf)} x {formatNumber(horizontalLoadProof.qp)} x {formatNumber(horizontalLoadProof.referenceAreaM2)} = {formatNumber(horizontalLoadProof.forceKN)} kN
                </Text>
              </>
            )}
          </View>

          <View style={styles.formulaCard}>
            <Text style={styles.formulaHeading}>Kippsicherheitsnachweis</Text>
            <Text style={styles.formulaLine}>
              Massgebende Windrichtung: {formatNumber(result.tipping.governingAngleDeg, 0)}°
            </Text>
            <Text style={styles.formulaLine}>Kippachse: {tippingProof.tippingAxisLabel}</Text>
            <Text style={styles.formulaLine}>
              Mk = Fw x h = {formatNumber(horizontalLoadProof.forceKN)} kN x {formatNumber(horizontalLoadProof.applicationHeightM)} m = {formatNumber(tippingProof.tippingMomentKNm)} kN.m
            </Text>
            <Text style={styles.formulaLine}>
              Ms = Rz x a = {formatNumber(tippingProof.stabilizingVerticalKN)} kN x {formatNumber(tippingProof.effectiveLeverArmM)} m = {formatNumber(tippingProof.stabilizingMomentKNm)} kN.m
            </Text>
            <Text style={styles.formulaLine}>
              Ausnutzung: eta = Mk / Ms = {formatNumber(tippingProof.tippingMomentKNm)} / {formatNumber(tippingProof.stabilizingMomentKNm)} = {formatNumber(result.tipping.governing.utilization)} {result.tipping.governing.utilization <= 1 ? "<= 1,0 OK" : "> 1,0 NICHT OK"}
            </Text>
          </View>

          <View style={styles.formulaCard}>
            <Text style={styles.formulaHeading}>Gleitnachweis</Text>
            <Text style={styles.formulaLine}>
              res.Fh = sqrt(Fx^2 + Fy^2) = sqrt({formatNumber(slidingProof.forceXKN)}^2 + {formatNumber(slidingProof.forceYKN)}^2) = {formatNumber(slidingProof.resultingHorizontalForceKN)} kN
            </Text>
            <Text style={styles.formulaLine}>
              erf. Ballast = Fh/mu - Fv = {formatNumber(slidingProof.resultingHorizontalForceKN)}/{formatNumber(frictionCoefficient)} - {formatNumber(slidingProof.totalVerticalReactionKN)} = {formatNumber(slidingProof.requiredVerticalDeficitKN)} kN
            </Text>
          </View>

          <View style={styles.formulaCard}>
            <Text style={styles.formulaHeading}>Biegemomentnachweis je Traverse</Text>
            {result.beams.map((beamResult) => {
              const beamInput = result.input.beams.find((beam) => beam.id === beamResult.beamId)
              const trussType = beamInput?.trussType
              const trussProperties = trussType ? getTrussProperties(trussType) : null
              const beamLabel = beamInput?.label ?? beamResult.beamId

              return (
                <View key={beamResult.beamId} style={{ marginBottom: 8 }}>
                  <Text style={styles.formulaLine}>{beamLabel}</Text>
                  <Text style={styles.formulaLine}>
                    MEd = {formatNumber(beamResult.maxBendingMomentKNm)} kN.m
                  </Text>
                  <Text style={styles.formulaLine}>
                    MRd = {formatNumber(trussProperties?.bendingResistanceY ?? 0)} kN.m (aus Systemstatik {trussType ? TRUSS_LABELS[trussType] : beamResult.beamId})
                  </Text>
                  <Text style={styles.formulaLine}>
                    eta = MEd/MRd = {formatNumber(beamResult.maxBendingMomentKNm)}/{formatNumber(trussProperties?.bendingResistanceY ?? 0)} = {formatNumber(beamResult.bendingUtilization)} {beamResult.bendingUtilization <= 1 ? "<= 1,0 OK" : "> 1,0 NICHT OK"}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Nachweise</Text>

        <View style={styles.section}>
          <Text style={styles.h3}>Traversen</Text>
          <Table
            headers={["Traverse", "M_max", "V_max", "eta Biegung", "eta Quer", "OK"]}
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
          <Text style={styles.h3}>Stuetzen / Knicken</Text>
          <Table
            headers={["Stuetze", "Rz", "Rx", "Ry", "eta Knicken", "OK"]}
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
            headers={["Richtung", "Kippachse", "eta", "Rz,min", "Ballast", "OK"]}
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
        <Text style={styles.h2}>Ballast und Normen</Text>

        <View style={styles.section}>
          <Table
            headers={["Stuetze", "Erforderlich", "Vorhanden", "Zusaetzlich"]}
            rows={result.ballastPerSupport.map((entry) => [
              entry.supportLabel,
              `${formatNumber(entry.requiredBallastKg, 0)} kg`,
              `${formatNumber(entry.existingBallastKg, 0)} kg`,
              `${formatNumber(entry.additionalBallastNeededKg, 0)} kg`,
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
