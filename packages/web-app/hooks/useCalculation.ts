"use client"

import { useCallback, useState } from "react"

import { defaultInput } from "@/lib/defaultInput"
import type { CalculationResult, StructureInput } from "@/lib/types-bridge"

// Platzhalter bis calc-engine fertig ist.
function calculate(_input: StructureInput): CalculationResult {
  void _input
  throw new Error("calc-engine noch nicht verbunden")
}

export function useCalculation() {
  const [input, setInput] = useState<StructureInput>(defaultInput)
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return { input, setInput, result, isCalculating, error, runCalculation }
}
