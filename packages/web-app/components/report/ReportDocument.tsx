import { Fragment } from "react"

import {
  Circle,
  Document,
  Page,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer"
import { getFrictionCoefficient } from "@truss-calculator/calc-engine"

import type { ReportData, Support } from "@/lib/types-bridge"
import { FOOT_LABELS, getWindDirectionDisplay, TERRAIN_LABELS, TRUSS_LABELS } from "@/lib/constants"

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
})

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("de-DE")
}

function PlanView({ supports }: { supports: Support[] }) {
  if (supports.length === 0) {
    return <Text style={styles.muted}>Keine Grundrissdaten vorhanden.</Text>
  }

  const xs = supports.map((support) => support.position.x)
  const ys = supports.map((support) => support.position.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = Math.max(maxX - minX, 1)
  const height = Math.max(maxY - minY, 1)
  const viewWidth = 240
  const viewHeight = 160
  const padding = 18
  const scale = Math.min((viewWidth - padding * 2) / width, (viewHeight - padding * 2) / height)
  const projectX = (value: number) => padding + (value - minX) * scale
  const projectY = (value: number) => viewHeight - padding - (value - minY) * scale

  return (
    <Svg width={viewWidth} height={viewHeight}>
      {supports.map((support) => (
        <Fragment key={support.id}>
          <Circle cx={projectX(support.position.x)} cy={projectY(support.position.y)} r={4} fill="#334155" />
          <Text
            style={{ fontSize: 8 }}
            x={projectX(support.position.x) + 6}
            y={projectY(support.position.y) - 4}
          >
            {support.label}
          </Text>
        </Fragment>
      ))}
    </Svg>
  )
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
        <View key={`${row.join("-")}-${rowIndex}`} style={rowIndex === rows.length - 1 ? styles.rowLast : styles.row}>
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

  return (
    <Document title={`Report ${result.input.projectName || "truss-calculator"}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.h1}>{config.companyName}</Text>
          <Text style={[styles.muted, { marginTop: 6 }]}>{config.companyAddress}</Text>
          <Text style={[styles.h2, { marginTop: 24, marginBottom: 6 }]}>
            Planungsreport Truss Calculator
          </Text>
          <Text style={styles.muted}>
            Projekt: {result.input.projectName || "-"}
          </Text>
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
            <View style={styles.card}>
              <Text style={styles.muted}>Erforderlicher Ballast gesamt</Text>
              <Text>{result.requiredBallastTotalKg.toFixed(0)} kg</Text>
            </View>
          </View>
        </View>

        <View style={styles.disclaimer}>
          <Text>{config.disclaimer}</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Systemuebersicht</Text>
        <View style={styles.grid2}>
          <View style={[styles.card, { flex: 1.2 }]}>
            <Text style={{ marginBottom: 8, fontWeight: 700 }}>Standort und System</Text>
            <Text>Windzone: {result.input.windZone}</Text>
            <Text>Gelaendekategorie: {TERRAIN_LABELS[result.input.terrainCategory]}</Text>
            <Text>Stuetzen: {result.input.supports.length}</Text>
            <Text>Traversen: {result.input.beams.length}</Text>
            <Text>Reibungsbeiwert: {frictionCoefficient.toFixed(2)}</Text>
          </View>
          <View style={[styles.card, { flex: 1, marginLeft: 12 }]}>
            <Text style={{ marginBottom: 8, fontWeight: 700 }}>Grundriss</Text>
            <PlanView supports={result.input.supports} />
          </View>
        </View>

        <View style={styles.section}>
          <Table
            headers={["Stuetze", "Typ", "Hoehe", "Fuss", "Ballast"]}
            rows={result.input.supports.map((support) => [
              support.label,
              TRUSS_LABELS[support.trussType],
              `${support.height.toFixed(2)} m`,
              FOOT_LABELS[support.footType],
              `${support.existingBallast.toFixed(0)} kg`,
            ])}
          />
        </View>

        <View style={styles.section}>
          <Text style={{ marginBottom: 8, fontWeight: 700 }}>Lasten</Text>
          <Table
            headers={["Traverse", "Element", "Position", "Gewicht"]}
            rows={result.input.beams.flatMap((beam) =>
              beam.loads.map((load) => [
                beam.label,
                load.label,
                `${load.positionAlongBeam.toFixed(2)} m`,
                `${load.weight.toFixed(0)} kg`,
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
        <Text style={styles.h2}>Nachweise</Text>

        <View style={styles.section}>
          <Text style={{ marginBottom: 8, fontWeight: 700 }}>Traversen</Text>
          <Table
            headers={["Traverse", "M_max", "V_max", "eta Biegung", "eta Quer", "OK"]}
            rows={result.beams.map((beam) => [
              result.input.beams.find((entry) => entry.id === beam.beamId)?.label ?? beam.beamId,
              `${beam.maxBendingMomentKNm.toFixed(2)} kNm`,
              `${beam.maxShearForceKN.toFixed(2)} kN`,
              beam.bendingUtilization.toFixed(2),
              beam.shearUtilization.toFixed(2),
              beam.isOk ? "Ja" : "Nein",
            ])}
          />
        </View>

        <View style={styles.section}>
          <Text style={{ marginBottom: 8, fontWeight: 700 }}>Stuetzen / Knicken</Text>
          <Table
            headers={["Stuetze", "Rz", "Rx", "Ry", "eta Knicken", "OK"]}
            rows={result.supports.map((support) => [
              result.input.supports.find((entry) => entry.id === support.supportId)?.label ?? support.supportId,
              `${support.verticalReactionKN.toFixed(2)} kN`,
              `${support.horizontalReactionXKN.toFixed(2)} kN`,
              `${support.horizontalReactionYKN.toFixed(2)} kN`,
              support.bucklingUtilization.toFixed(2),
              support.isOk ? "Ja" : "Nein",
            ])}
          />
        </View>

        <View style={styles.section}>
          <Text style={{ marginBottom: 8, fontWeight: 700 }}>Kippen / Gleiten</Text>
          <Table
            headers={["Richtung", "eta", "Rz,min", "Ballast", "OK"]}
            rows={[
              ...result.tipping.directions.map(({ angleDeg, result: directionResult }) => [
                getWindDirectionDisplay(angleDeg),
                directionResult.utilization.toFixed(2),
                `${directionResult.minVerticalReactionKN.toFixed(2)} kN`,
                `${directionResult.requiredBallastTotalKg.toFixed(0)} kg`,
                directionResult.isOk ? "Ja" : "Nein",
              ]),
              ["Gleiten", "-", `${result.sliding.resultingHorizontalForceKN.toFixed(2)} kN`, `${Math.max(0, result.sliding.requiredBallastKg).toFixed(0)} kg`, result.sliding.isOk ? "Ja" : "Nein"],
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
              `${entry.requiredBallastKg.toFixed(0)} kg`,
              `${entry.existingBallastKg.toFixed(0)} kg`,
              `${entry.additionalBallastNeededKg.toFixed(0)} kg`,
            ])}
          />
        </View>

        <View style={styles.section}>
          <Text style={{ marginBottom: 8, fontWeight: 700 }}>Normverweise</Text>
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
