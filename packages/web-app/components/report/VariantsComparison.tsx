import { StyleSheet, Text, View } from "@react-pdf/renderer"

import type { CalculationResult, VariantResult } from "@/lib/types-bridge"

const styles = StyleSheet.create({
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
    paddingVertical: 6,
    paddingHorizontal: 7,
    fontSize: 8.6,
  },
  variantCell: {
    width: "26%",
  },
  ballastCell: {
    width: "17%",
  },
  deltaCell: {
    width: "17%",
  },
  statusCell: {
    width: "13%",
  },
  noteCell: {
    width: "27%",
  },
  muted: {
    color: "#475569",
  },
  ok: {
    color: "#166534",
    fontWeight: 700,
  },
  bad: {
    color: "#b91c1c",
    fontWeight: 700,
  },
})

function formatNumber(value: number, digits = 0) {
  if (!Number.isFinite(value)) return "0"
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function formatDelta(baselineKg: number, variantKg: number) {
  const deltaKg = variantKg - baselineKg
  const percent = baselineKg > 0 ? (deltaKg / baselineKg) * 100 : 0
  const sign = deltaKg > 0 ? "+" : ""
  return `${sign}${formatNumber(deltaKg)} kg (${sign}${formatNumber(percent)} %)`
}

export function VariantsComparison({
  baseline,
  variants,
}: {
  baseline: CalculationResult
  variants: VariantResult[]
}) {
  const sorted = [...variants].sort(
    (a, b) => a.result.requiredBallastTotalKg - b.result.requiredBallastTotalKg,
  )

  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.head]}>
        <Text style={[styles.cell, styles.variantCell]}>Variante</Text>
        <Text style={[styles.cell, styles.ballastCell]}>Zusatzballast</Text>
        <Text style={[styles.cell, styles.deltaCell]}>Δ zur Basis</Text>
        <Text style={[styles.cell, styles.statusCell]}>Status</Text>
        <Text style={[styles.cell, styles.noteCell]}>Wirkprinzip</Text>
      </View>
      {sorted.map((entry, index) => {
        const isLast = index === sorted.length - 1
        return (
          <View key={entry.variant.label} style={isLast ? styles.rowLast : styles.row}>
            <Text style={[styles.cell, styles.variantCell]}>{entry.variant.label}</Text>
            <Text style={[styles.cell, styles.ballastCell]}>
              {formatNumber(entry.result.requiredBallastTotalKg)} kg
            </Text>
            <Text style={[styles.cell, styles.deltaCell]}>
              {formatDelta(baseline.requiredBallastTotalKg, entry.result.requiredBallastTotalKg)}
            </Text>
            <Text style={[styles.cell, styles.statusCell, entry.result.overallOk ? styles.ok : styles.bad]}>
              {entry.result.overallOk ? "OK" : "Prüfen"}
            </Text>
            <Text style={[styles.cell, styles.noteCell, styles.muted]}>{entry.variant.description}</Text>
          </View>
        )
      })}
    </View>
  )
}
