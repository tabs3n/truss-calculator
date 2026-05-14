"use client"

import type { CalculationResult, Support } from "@/lib/types-bridge"

interface Recommendation {
  severity: "warning" | "info" | "tip"
  title: string
  description: string
  /** Optionale Schätzung der Auswirkung */
  estimatedImpact?: string
}

const SEVERITY_STYLE: Record<Recommendation["severity"], string> = {
  warning: "border-destructive/40 bg-destructive/5 text-destructive",
  info: "border-amber-300 bg-amber-50 text-amber-900",
  tip: "border-emerald-300 bg-emerald-50 text-emerald-900",
}

const SEVERITY_LABEL: Record<Recommendation["severity"], string> = {
  warning: "Kritisch",
  info: "Hinweis",
  tip: "Empfehlung",
}

function buildRecommendations(result: CalculationResult): Recommendation[] {
  const recs: Recommendation[] = []
  const { input, tipping, sliding, requiredBallastTotalKg, designFactors } = result

  // 1. Ballast > 10 t → vermutlich ungünstige Konfiguration
  if (requiredBallastTotalKg > 10000) {
    recs.push({
      severity: "warning",
      title: `Sehr hoher Ballastbedarf: ${(requiredBallastTotalKg / 1000).toFixed(1)} t`,
      description:
        "Bei Ballast > 10 t ist die Konfiguration meist nicht praxistauglich. Mögliche Ursachen: zu großer Hebelarm zwischen Wind und Standfläche, ungünstige Kippachsen-Geometrie oder fehlende Outrigger. Prüfe die Punkte weiter unten.",
    })
  }

  // 2. BASEPLATE ohne Outrigger UND Kippen maßgebend
  const baseplateSupportsWithoutOutrigger = input.supports.filter(
    (s) => s.footType === "BASEPLATE" && (!s.outriggerLength || s.outriggerLength <= 0),
  )
  if (baseplateSupportsWithoutOutrigger.length > 0 && tipping.governing.effectiveLeverArmM < 1.0) {
    // Schätzung: Outrigger 1,5 m statt 0,3 m → Hebelarm ca. 5× → Ballast ~80% weniger
    const ratio = 1.5 / Math.max(tipping.governing.effectiveLeverArmM, 0.1)
    const estimatedBallast = Math.max(0, requiredBallastTotalKg / ratio)
    const savings = requiredBallastTotalKg - estimatedBallast
    const savingsPct = Math.round((savings / requiredBallastTotalKg) * 100)
    recs.push({
      severity: "warning",
      title: `${baseplateSupportsWithoutOutrigger.length} Bodenplatte(n) ohne Outrigger`,
      description: `Wirksamer Hebelarm aktuell nur ${tipping.governing.effectiveLeverArmM.toFixed(2)} m. Mit Outrigger 1,5 m oder Concrete Blocks (Hebelarm 0,60 m) verringert sich der Ballastbedarf drastisch.`,
      estimatedImpact: `Schätzung mit 1,5 m Outrigger: ~${(estimatedBallast / 1000).toFixed(1)} t (−${savingsPct}%, spart ~${(savings / 1000).toFixed(1)} t).`,
    })
  }

  // 3. Kippachse durch alle/viele Stützen → 2-Stützen-Anordnung mit Wind quer
  if (
    tipping.governing.tippingAxisSupportIds.length === input.supports.length &&
    input.supports.length === 2 &&
    !tipping.governing.isOk
  ) {
    recs.push({
      severity: "warning",
      title: "Kippachse durch beide Stützen (klassische 2-Stützen-Falle)",
      description:
        "Bei nur 2 Stützen auf einer Linie und Wind quer dazu liegen beide Stützen auf der Kippachse. Der wirksame Hebelarm reduziert sich auf die Bodenplattenbreite. Eine 3. Stütze quer zur Hauptachse oder größere Outrigger lösen das Problem.",
    })
  }

  // 4. Wenig Reibung
  if (sliding.frictionCoefficientUsed < 0.4 && !sliding.isOk) {
    recs.push({
      severity: "info",
      title: `Reibwert µ = ${sliding.frictionCoefficientUsed.toFixed(2)} relativ niedrig`,
      description:
        "Bessere Untergrund-/Stützen-Kombination (z.B. Gummi auf Beton µ = 0,70, Holz auf Beton µ = 0,60) reduziert den Gleitballast.",
    })
  }

  // 5. Wind hits broadside (asymmetric Aref)
  if (input.environment === "OUTDOOR" && input.beams.some((b) => b.windSurfaces.length > 0)) {
    const totalWindArea = input.beams.reduce(
      (sum, b) => sum + b.windSurfaces.reduce((s, w) => s + w.width * w.height, 0),
      0,
    )
    if (totalWindArea > 20) {
      recs.push({
        severity: "info",
        title: `Große Windangriffsfläche: ${totalWindArea.toFixed(0)} m²`,
        description:
          "Bei großen Bannern/LED-Wänden lohnt es sich, manuell die Windrichtungen zu prüfen und ggf. die Fläche zu segmentieren oder Mesh-Material zu verwenden (cf 0,3 statt 1,3 reduziert Last um 75%).",
      })
    }
  }

  // 6. Multi-Support-Hinweis bei langen Spannweiten ohne Zwischenstütze
  for (const beam of input.beams) {
    const supportIds = beam.supportIds && beam.supportIds.length >= 2
      ? beam.supportIds
      : [beam.startSupportId, beam.endSupportId]
    if (supportIds.length === 2) {
      const a = input.supports.find((s: Support) => s.id === supportIds[0])
      const b = input.supports.find((s: Support) => s.id === supportIds[1])
      if (a && b) {
        const span = Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y)
        if (span > 6) {
          const beamResult = result.beams.find((br) => br.beamId === beam.id)
          if (beamResult && beamResult.bendingUtilization > 0.7) {
            recs.push({
              severity: "tip",
              title: `Traverse ${beam.label}: ${span.toFixed(1)} m Spannweite`,
              description: `Biegeausnutzung η = ${beamResult.bendingUtilization.toFixed(2)}. Eine Zwischenstütze halbiert das Biegemoment ungefähr — das Feature ist im Traverse-Editor unter "Zwischenstützen" verfügbar.`,
            })
          }
        }
      }
    }
  }

  // 7. Erfolgreich, aber hoher Bemessungsfaktor-Hinweis
  if (result.overallOk && designFactors.horizontalDesignFactor > 1) {
    recs.push({
      severity: "tip",
      title: "Berechnung erfolgreich",
      description: `Wind wird mit γQ × Dyn = ${designFactors.horizontalDesignFactor.toFixed(2)} bemessen (DIN EN 1990 + DGUV 215-313). Stabilisierende Lasten mit γG,inf = ${designFactors.gammaGinf.toFixed(2)}. Bei Outdoor-Setups sind 1,8 × charakt. Wind normal.`,
    })
  }

  return recs
}

export function Recommendations({ result }: { result: CalculationResult | null }) {
  if (!result) return null
  const recs = buildRecommendations(result)
  if (recs.length === 0) return null

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Empfehlungen</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Automatische Analyse des Ergebnisses mit konkreten Verbesserungsvorschlägen.
        </p>
      </div>
      <div className="space-y-3">
        {recs.map((rec, idx) => (
          <article
            key={idx}
            className={`rounded-2xl border p-4 text-sm ${SEVERITY_STYLE[rec.severity]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{rec.title}</h3>
              <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]">
                {SEVERITY_LABEL[rec.severity]}
              </span>
            </div>
            <p className="mt-2">{rec.description}</p>
            {rec.estimatedImpact ? (
              <p className="mt-2 rounded-lg bg-background/60 px-3 py-2 text-xs font-medium">
                💡 {rec.estimatedImpact}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
