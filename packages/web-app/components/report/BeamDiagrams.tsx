import { Circle, Line, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer"

import type { BeamResult, BeamSample } from "@/lib/types-bridge"

type SampleAccessor = (sample: BeamSample) => number

const styles = StyleSheet.create({
  wrapper: {
    border: "1 solid #dbe4ee",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#ffffff",
    marginBottom: 10,
  },
  beamTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  empty: {
    color: "#64748b",
    fontSize: 9,
  },
})

function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "0,00"
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function getAbsoluteMax(samples: BeamSample[], getValue: SampleAccessor) {
  return samples.reduce((max, sample) => Math.max(max, Math.abs(getValue(sample))), 0)
}

function getGoverningSample(samples: BeamSample[], getValue: SampleAccessor) {
  return samples.reduce((governing, sample) =>
    Math.abs(getValue(sample)) > Math.abs(getValue(governing)) ? sample : governing,
  )
}

function createPath(samples: BeamSample[], getValue: SampleAccessor, toX: (sample: BeamSample) => number, toY: (value: number) => number) {
  return samples
    .map((sample, index) => {
      const command = index === 0 ? "M" : "L"
      return `${command} ${toX(sample).toFixed(2)} ${toY(getValue(sample)).toFixed(2)}`
    })
    .join(" ")
}

function MiniDiagram({
  title,
  unit,
  samples,
  getValue,
  stroke,
  digits = 2,
}: {
  title: string
  unit: string
  samples: BeamSample[]
  getValue: SampleAccessor
  stroke: string
  digits?: number
}) {
  const width = 160
  const height = 112
  const paddingLeft = 24
  const paddingRight = 10
  const paddingTop = 24
  const paddingBottom = 20
  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom
  const xMin = Math.min(...samples.map(sample => sample.xM))
  const xMax = Math.max(...samples.map(sample => sample.xM))
  const xRange = Math.max(xMax - xMin, 0.001)
  const maxAbs = Math.max(getAbsoluteMax(samples, getValue), 0.001)
  const governingSample = getGoverningSample(samples, getValue)
  const governingValue = getValue(governingSample)
  const zeroY = paddingTop + plotHeight / 2
  const toX = (sample: BeamSample) => paddingLeft + ((sample.xM - xMin) / xRange) * plotWidth
  const toY = (value: number) => zeroY - (value / maxAbs) * (plotHeight / 2)
  const path = createPath(samples, getValue, toX, toY)

  return (
    <Svg width={width} height={height}>
      <Rect x={0.5} y={0.5} width={width - 1} height={height - 1} rx={6} fill="#f8fafc" stroke="#dbe4ee" />
      <Text x={8} y={14} style={{ fontSize: 8.5, fontWeight: 700, fill: "#0f172a" }}>
        {title}
      </Text>
      <Text x={width - 58} y={14} style={{ fontSize: 6.8, fill: "#475569" }}>
        max {formatNumber(Math.abs(governingValue), digits)} {unit}
      </Text>
      <Line x1={paddingLeft} y1={zeroY} x2={width - paddingRight} y2={zeroY} stroke="#cbd5e1" strokeWidth={0.8} />
      <Line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} stroke="#cbd5e1" strokeWidth={0.8} />
      <Path d={path} fill="none" stroke={stroke} strokeWidth={1.6} />
      <Circle cx={toX(governingSample)} cy={toY(governingValue)} r={2.4} fill={stroke} />
      <Text x={paddingLeft - 18} y={paddingTop + 3} style={{ fontSize: 6.5, fill: "#64748b" }}>
        +{formatNumber(maxAbs, digits)}
      </Text>
      <Text x={paddingLeft - 16} y={height - paddingBottom + 2} style={{ fontSize: 6.5, fill: "#64748b" }}>
        -{formatNumber(maxAbs, digits)}
      </Text>
      <Text x={paddingLeft} y={height - 7} style={{ fontSize: 6.5, fill: "#64748b" }}>
        x {formatNumber(xMin, 1)} m
      </Text>
      <Text x={width - 48} y={height - 7} style={{ fontSize: 6.5, fill: "#64748b" }}>
        {formatNumber(xMax, 1)} m
      </Text>
    </Svg>
  )
}

export function BeamDiagrams({
  beam,
  beamLabel,
}: {
  beam: BeamResult
  beamLabel: string
}) {
  const samples = beam.samples ?? []

  return (
    <View style={styles.wrapper} wrap={false}>
      <Text style={styles.beamTitle}>
        {beamLabel}: Mmax {formatNumber(beam.maxBendingMomentKNm)} kN*m, Vmax {formatNumber(beam.maxShearForceKN)} kN,
        wmax {formatNumber(beam.maxDeflectionMm)} mm
      </Text>
      {samples.length < 2 ? (
        <Text style={styles.empty}>Keine Schnittkraftdaten vorhanden.</Text>
      ) : (
        <View style={styles.row}>
          <MiniDiagram
            title="Moment M"
            unit="kN*m"
            samples={samples}
            getValue={sample => sample.momentKNm}
            stroke="#2563eb"
          />
          <MiniDiagram
            title="Querkraft V"
            unit="kN"
            samples={samples}
            getValue={sample => sample.shearKN}
            stroke="#7c3aed"
          />
          <MiniDiagram
            title="Biegelinie w"
            unit="mm"
            samples={samples}
            getValue={sample => sample.deflectionMm}
            stroke="#059669"
          />
        </View>
      )}
    </View>
  )
}
