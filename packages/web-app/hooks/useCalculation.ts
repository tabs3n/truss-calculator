"use client"

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react"

import { calculate } from "@truss-calculator/calc-engine"
import { defaultInput } from "@/lib/defaultInput"
import type { CalculationResult, StructureInput } from "@/lib/types-bridge"

const STORAGE_KEY = "truss-calculator-draft-v1"
const STORAGE_DEBOUNCE_MS = 600

function loadDraft(): StructureInput | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StructureInput>
    // Minimale Plausibilität: muss supports + beams haben
    if (parsed && Array.isArray(parsed.supports) && Array.isArray(parsed.beams)) {
      return parsed as StructureInput
    }
    return null
  } catch {
    return null
  }
}

function saveDraft(input: StructureInput) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  } catch {
    // Quota voll oder Storage gesperrt – ignorieren
  }
}

function clearDraft() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function useCalculation() {
  const [input, setInput] = useState<StructureInput>(defaultInput)
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Beim ersten Mount: Draft aus localStorage versuchen wiederherzustellen
  useEffect(() => {
    const draft = loadDraft()
    if (draft) {
      setInput(draft)
      setHasRestoredDraft(true)
    }
  }, [])

  // Auto-Save bei jeder Input-Änderung (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveDraft(input)
    }, STORAGE_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [input])

  const updateInput = useCallback((next: SetStateAction<StructureInput>) => {
    setInput((current) => (typeof next === "function" ? next(current) : next))
    setResult(null)
    setError(null)
  }, [])

  const runCalculation = useCallback(() => {
    setIsCalculating(true)
    setError(null)

    try {
      const res = calculate(input)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler")
    } finally {
      setIsCalculating(false)
    }
  }, [input])

  const resetToDefault = useCallback(() => {
    setInput(defaultInput)
    setResult(null)
    setError(null)
    setHasRestoredDraft(false)
    clearDraft()
  }, [])

  const dismissRestoredDraft = useCallback(() => {
    setHasRestoredDraft(false)
  }, [])

  return {
    input,
    setInput: updateInput,
    result,
    isCalculating,
    error,
    runCalculation,
    hasRestoredDraft,
    dismissRestoredDraft,
    resetToDefault,
  }
}
