import type { CalculationResult, ConnectionResult } from "@/lib/types-bridge"

function Row({ entry }: { entry: ConnectionResult }) {
  const fillPct = (Math.min(entry.utilization, 1.5) / 1.5) * 100
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium">{entry.label}</span>
        <span className={entry.isOk ? "text-muted-foreground" : "font-semibold text-destructive"}>
          {entry.actingValue.toFixed(entry.unit === "kg" ? 0 : 1)} / {entry.capacityValue.toFixed(entry.unit === "kg" ? 0 : 1)} {entry.unit} · η = {entry.utilization.toFixed(2)}
        </span>
      </div>
      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${entry.isOk ? "bg-emerald-500" : "bg-destructive"}`}
          style={{ width: `${fillPct}%` }}
        />
        <div className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${(1 / 1.5) * 100}%` }} />
      </div>
    </div>
  )
}

export function ConnectionResults({ result }: { result: CalculationResult | null }) {
  if (!result) return null
  const connections = result.connections ?? []
  if (connections.length === 0) return null

  const couplers = connections.filter((c) => c.kind === "COUPLER")
  const nodes = connections.filter((c) => c.kind === "NODE")
  const allOk = connections.every((c) => c.isOk)

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Verbindungen &amp; Kupplungen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Anschlussmittel je Last (WLL) und Gurtrohr-Knoten je Stütze.
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
            allOk ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"
          }`}
        >
          {allOk ? "OK" : "kritisch"}
        </span>
      </div>

      {couplers.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Kupplungen / Anschlussmittel
          </p>
          {couplers.map((c) => (
            <Row key={c.id} entry={c} />
          ))}
        </div>
      ) : null}

      {nodes.length > 0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Gurtrohr / Knoten (N/4 ≤ N<sub>ch,Rd</sub>)
          </p>
          {nodes.map((c) => (
            <Row key={c.id} entry={c} />
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-xs text-muted-foreground">
        Kupplung: Last × Dynamikzuschlag (1,20) gegen WLL. Gurtrohr: Auflagerkraft auf 4 Gurtrohre
        verteilt gegen N<sub>ch,Rd</sub> aus der Systemstatik.
      </p>
    </section>
  )
}
