"use client"

import { useCallback, useState, type SetStateAction } from "react"

import { calculate } from "@truss-calculator/calc-engine"
import { defaultInput } from "@/lib/defaultInput"
import type { CalculationResult, StructureInput } from "@/lib/types-bridge"

export function useCalculation() {
  const [input, setInput] = useState<StructureInput>(defaultInput)
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return { input, setInput: updateInput, result, isCalculating, error, runCalculation }
}
