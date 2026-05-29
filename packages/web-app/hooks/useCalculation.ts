"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react"

import { calculate } from "@truss-calculator/calc-engine"
import { defaultInput } from "@/lib/defaultInput"
import type { CalculationResult, StructureInput } from "@/lib/types-bridge"

const STORAGE_KEY = "truss-calculator-draft-v1"
const HISTORY_KEY = "truss-calculator-history-v1"
const LIVE_PREF_KEY = "truss-calculator-live-pref-v1"
const STORAGE_DEBOUNCE_MS = 600
const LIVE_CALC_DEBOUNCE_MS = 300
const MAX_HISTORY_ENTRIES = 10

// ───────────────────────────────────────────────
// Persistente Modelle
// ───────────────────────────────────────────────

export interface CalculationHistoryEntry {
  id: string
  timestamp: string         // ISO 8601
  label: string             // anzeigbarer Name
  input: StructureInput
  summary: {
    overallOk: boolean
    requiredBallastTotalKg: number
    governingAngleDeg: number
    errorsCount: number
  }
}

// ───────────────────────────────────────────────
// Storage-Helpers
// ───────────────────────────────────────────────

function safeRead<T>(key: string): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota voll oder Storage gesperrt – ignorieren
  }
}

function safeRemove(key: string) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

function loadDraft(): StructureInput | null {
  const parsed = safeRead<Partial<StructureInput>>(STORAGE_KEY)
  if (!parsed || !Array.isArray(parsed.supports) || !Array.isArray(parsed.beams)) return null
  return parsed as StructureInput
}

function loadHistory(): CalculationHistoryEntry[] {
  const entries = safeRead<CalculationHistoryEntry[]>(HISTORY_KEY)
  if (!Array.isArray(entries)) return []
  // Defensiv: nur valide Einträge
  return entries.filter(
    (e) =>
      e &&
      typeof e.id === "string" &&
      typeof e.timestamp === "string" &&
      typeof e.label === "string" &&
      e.input &&
      Array.isArray(e.input.supports),
  )
}

function loadLivePreference(): boolean {
  if (typeof window === "undefined") return true
  try {
    const raw = window.localStorage.getItem(LIVE_PREF_KEY)
    return raw === null ? true : raw === "true"
  } catch {
    return true
  }
}

// ───────────────────────────────────────────────
// Hook
// ───────────────────────────────────────────────

export function useCalculation() {
  const [input, setInput] = useState<StructureInput>(defaultInput)
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false)
  const [liveCalculation, setLiveCalculationState] = useState(true)
  const [history, setHistory] = useState<CalculationHistoryEntry[]>([])

  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const liveCalcDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasMountedRef = useRef(false)

  // ─── Mount: Draft + History + Live-Pref laden ───────────────────────────
  // Bewusst per Effect (nicht via useState-Initializer): localStorage ist nur
  // clientseitig verfügbar, ein Initializer-Read würde beim SSR einen
  // Hydration-Mismatch erzeugen (Server kennt den Draft nicht). Die State-Updates
  // beim Mount sind daher zulässig.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const draft = loadDraft()
    if (draft) {
      setInput(draft)
      setHasRestoredDraft(true)
    }
    setHistory(loadHistory())
    setLiveCalculationState(loadLivePreference())
    /* eslint-enable react-hooks/set-state-in-effect */
    hasMountedRef.current = true
  }, [])

  // ─── Auto-Save Draft (debounced) ────────────────────────────────────────
  useEffect(() => {
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => {
      safeWrite(STORAGE_KEY, input)
    }, STORAGE_DEBOUNCE_MS)
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    }
  }, [input])

  // ─── Live-Berechnung (debounced) ────────────────────────────────────────
  useEffect(() => {
    if (!hasMountedRef.current) return
    if (!liveCalculation) return
    if (liveCalcDebounceRef.current) clearTimeout(liveCalcDebounceRef.current)
    liveCalcDebounceRef.current = setTimeout(() => {
      try {
        const res = calculate(input)
        setResult(res)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unbekannter Fehler")
      }
    }, LIVE_CALC_DEBOUNCE_MS)
    return () => {
      if (liveCalcDebounceRef.current) clearTimeout(liveCalcDebounceRef.current)
    }
  }, [input, liveCalculation])

  // ─── Eingabe ändern: bei OFF-Modus Result invalidieren ──────────────────
  const updateInput = useCallback((next: SetStateAction<StructureInput>) => {
    setInput((current) => (typeof next === "function" ? next(current) : next))
    if (!liveCalculation) {
      setResult(null)
      setError(null)
    }
  }, [liveCalculation])

  // ─── Manuelles Berechnen (mit History-Snapshot) ─────────────────────────
  const runCalculation = useCallback(() => {
    setIsCalculating(true)
    setError(null)
    try {
      const res = calculate(input)
      setResult(res)
      // Manueller Klick erzeugt einen History-Eintrag
      const entry: CalculationHistoryEntry = {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
        timestamp: new Date().toISOString(),
        label: input.projectName || `Berechnung ${new Date().toLocaleString("de-DE")}`,
        input,
        summary: {
          overallOk: res.overallOk,
          requiredBallastTotalKg: res.requiredBallastTotalKg,
          governingAngleDeg: res.tipping.governingAngleDeg,
          errorsCount: res.errors.length + res.proofFailures.length,
        },
      }
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, MAX_HISTORY_ENTRIES)
        safeWrite(HISTORY_KEY, next)
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler")
    } finally {
      setIsCalculating(false)
    }
  }, [input])

  const setLiveCalculation = useCallback((value: boolean) => {
    setLiveCalculationState(value)
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LIVE_PREF_KEY, String(value))
      } catch {
        /* ignore */
      }
    }
  }, [])

  // ─── History-Operationen ────────────────────────────────────────────────
  const restoreFromHistory = useCallback((id: string) => {
    const entry = history.find((e) => e.id === id)
    if (!entry) return
    setInput(entry.input)
    setError(null)
    // Live-Modus rechnet automatisch nach
    if (!liveCalculation) setResult(null)
  }, [history, liveCalculation])

  const deleteHistoryEntry = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((e) => e.id !== id)
      safeWrite(HISTORY_KEY, next)
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    safeRemove(HISTORY_KEY)
  }, [])

  const resetToDefault = useCallback(() => {
    setInput(defaultInput)
    setResult(null)
    setError(null)
    setHasRestoredDraft(false)
    safeRemove(STORAGE_KEY)
  }, [])

  const dismissRestoredDraft = useCallback(() => {
    setHasRestoredDraft(false)
  }, [])

  const summary = useMemo(
    () => ({
      historyCount: history.length,
      liveCalculation,
    }),
    [history.length, liveCalculation],
  )

  return {
    // Daten
    input,
    setInput: updateInput,
    result,
    isCalculating,
    error,
    history,
    // Aktionen
    runCalculation,
    resetToDefault,
    hasRestoredDraft,
    dismissRestoredDraft,
    liveCalculation,
    setLiveCalculation,
    restoreFromHistory,
    deleteHistoryEntry,
    clearHistory,
    // Hilfsdaten
    summary,
  }
}
