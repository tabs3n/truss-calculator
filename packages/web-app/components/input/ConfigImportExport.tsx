"use client"

import { useRef, useState } from "react"
import { Download, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { StructureInput } from "@/lib/types-bridge"

const EXPORT_VERSION = "1.0"

interface ConfigEnvelope {
  __schema: "truss-calculator-config"
  version: string
  exportedAt: string
  input: StructureInput
}

function isConfigEnvelope(value: unknown): value is ConfigEnvelope {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    v.__schema === "truss-calculator-config" &&
    typeof v.version === "string" &&
    typeof v.input === "object" &&
    v.input !== null &&
    Array.isArray((v.input as Record<string, unknown>).supports) &&
    Array.isArray((v.input as Record<string, unknown>).beams)
  )
}

function sanitizeFilename(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").substring(0, 60) || "konfiguration"
}

export function ConfigImportExport({
  input,
  onImport,
}: {
  input: StructureInput
  onImport: (next: StructureInput) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleExport = () => {
    setError(null)
    setSuccess(null)
    const envelope: ConfigEnvelope = {
      __schema: "truss-calculator-config",
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      input,
    }
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const name = sanitizeFilename(input.projectName || "truss-config")
    link.href = url
    link.download = `${name}-${new Date().toISOString().substring(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setSuccess(`Konfiguration als ${link.download} exportiert.`)
  }

  const handleImportClick = () => {
    setError(null)
    setSuccess(null)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)
      if (!isConfigEnvelope(parsed)) {
        setError("Datei entspricht nicht dem erwarteten Schema (truss-calculator-config).")
        return
      }
      onImport(parsed.input)
      setSuccess(`Konfiguration "${parsed.input.projectName || "ohne Namen"}" geladen.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Datei konnte nicht gelesen werden.")
    } finally {
      // Input zurücksetzen, damit dieselbe Datei erneut gewählt werden kann
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleExport}>
          <Download />
          Konfiguration exportieren
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleImportClick}>
          <Upload />
          Konfiguration importieren
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : success ? (
        <p className="text-xs text-emerald-700">{success}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          JSON-Format mit Schema-Versionierung. Konfigurationen können zwischen Geräten ausgetauscht werden.
        </p>
      )}
    </div>
  )
}
