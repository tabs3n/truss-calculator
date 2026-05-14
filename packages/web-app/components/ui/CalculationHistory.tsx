"use client"

import { useState } from "react"
import { Clock, RotateCcw, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { CalculationHistoryEntry } from "@/hooks/useCalculation"

function formatTime(iso: string): string {
  try {
    const date = new Date(iso)
    return date.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export function CalculationHistory({
  history,
  onRestore,
  onDelete,
  onClear,
}: {
  history: CalculationHistoryEntry[]
  onRestore: (id: string) => void
  onDelete: (id: string) => void
  onClear: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (history.length === 0) {
    return (
      <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Clock className="h-5 w-5" />
          Verlauf
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Manuelle „Berechnen"-Klicks werden hier als Snapshot gespeichert (max. 10).
        </p>
      </section>
    )
  }

  const visible = expanded ? history : history.slice(0, 3)

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Clock className="h-5 w-5" />
          Verlauf
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {history.length}
          </span>
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground transition-colors hover:text-destructive"
          title="Verlauf löschen"
        >
          Alle löschen
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {visible.map((entry) => {
          const tone = entry.summary.overallOk ? "emerald" : "destructive"
          const ballastT = (entry.summary.requiredBallastTotalKg / 1000).toFixed(1)
          return (
            <li
              key={entry.id}
              className="group flex items-start gap-2 rounded-xl border border-border bg-background/80 p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{entry.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatTime(entry.timestamp)}
                  <span className="mx-2">·</span>
                  <span
                    className={
                      tone === "emerald" ? "text-emerald-700 font-medium" : "text-destructive font-medium"
                    }
                  >
                    {entry.summary.overallOk ? "OK" : "kritisch"}
                  </span>
                  <span className="mx-2">·</span>
                  {ballastT} t Ballast
                </p>
              </div>
              <div className="flex flex-shrink-0 gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRestore(entry.id)}
                  title="Wiederherstellen"
                  className="h-8 w-8"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(entry.id)}
                  title="Eintrag löschen"
                  className="h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      {history.length > 3 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? "Weniger anzeigen" : `${history.length - 3} weitere anzeigen`}
        </button>
      ) : null}
    </section>
  )
}
