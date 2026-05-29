"use client"

import { useMemo } from "react"
import { AlertTriangle, CheckCircle2, Info } from "lucide-react"

import { validateStructureInput } from "@truss-calculator/calc-engine"
import type { StructureInput, ValidationIssue } from "@/lib/types-bridge"

/**
 * Zeigt die Hinweise aus validateStructureInput() an: Geometrie- und
 * Eingabeprüfungen mit konkreten Lösungsvorschlägen – bevor gerechnet wird.
 */
export function ValidationNotices({ input }: { input: StructureInput }) {
  const issues = useMemo<ValidationIssue[]>(() => validateStructureInput(input), [input])

  const errors = issues.filter((issue) => issue.severity === "error")
  const warnings = issues.filter((issue) => issue.severity === "warning")

  // Erst ab einer minimal sinnvollen Eingabe (>=2 Stützen) Erfolg melden,
  // sonst wirkt die grüne Box auf der leeren Startseite irritierend.
  if (issues.length === 0) {
    if (input.supports.length < 2) return null
    return (
      <section className="rounded-[1.5rem] border border-emerald-300 bg-emerald-50/70 p-4 text-sm text-emerald-800 shadow-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-medium">Eingaben plausibel – keine Geometrie-Hinweise.</span>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="mb-3">
        <h2 className="text-xl font-semibold">Eingabe-Prüfung</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Automatische Plausibilitätsprüfung der Geometrie und Lasten.
        </p>
      </div>

      <div className="space-y-2">
        {errors.map((issue, index) => (
          <IssueRow key={`err-${index}`} issue={issue} tone="error" />
        ))}
        {warnings.map((issue, index) => (
          <IssueRow key={`warn-${index}`} issue={issue} tone="warning" />
        ))}
      </div>
    </section>
  )
}

function IssueRow({ issue, tone }: { issue: ValidationIssue; tone: "error" | "warning" }) {
  const isError = tone === "error"
  return (
    <article
      className={`rounded-2xl border p-3 text-sm ${
        isError
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-amber-300 bg-amber-50 text-amber-900"
      }`}
    >
      <div className="flex items-start gap-2">
        {isError ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="font-medium">{issue.message}</p>
          {issue.suggestion ? (
            <p className="mt-1 text-xs opacity-80">💡 {issue.suggestion}</p>
          ) : null}
        </div>
      </div>
    </article>
  )
}
