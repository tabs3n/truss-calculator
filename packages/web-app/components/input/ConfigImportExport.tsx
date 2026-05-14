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
  variant = "section",
}: {
  input: StructureInput
  onImport: (next: StructureInput) => void
  /** "section" = eigene Karte mit Titel; "sidebar" = nur Buttons full-width */
  variant?: "section" | "sidebar"
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
    setSuccess(`Heruntergeladen: ${link.download}`)
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
      setSuccess(`Geladen: „${parsed.input.projectName || "ohne Namen"}"`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Datei konnte nicht gelesen werden.")
    } finally {
      // Input zurücksetzen, damit dieselbe Datei erneut gewählt werden kann
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const hiddenFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="application/json,.json"
      className="hidden"
      onChange={handleFileChange}
    />
  )

  if (variant === "sidebar") {
    return (
      <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Speichern &amp; Laden</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Konfiguration als JSON herunterladen oder von Festplatte einlesen.
        </p>
        <div className="mt-5 space-y-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full text-sm font-semibold"
            onClick={handleExport}
          >
            <Download />
            Als JSON exportieren
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full text-sm font-semibold"
            onClick={handleImportClick}
          >
            <Upload />
            JSON importieren
          </Button>
          {hiddenFileInput}
        </div>
        {error ? (
          <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        ) : success ? (
          <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-700">
            {success}
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            Schema-versioniert (truss-calculator-config v{EXPORT_VERSION}). Funktioniert
            geräteübergreifend.
          </p>
        )}
      </section>
    )
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
        {hiddenFileInput}
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
