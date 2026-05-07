"use client"

import { useMemo, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"

import { SupportForm } from "@/components/input/SupportForm"
import { Button } from "@/components/ui/button"
import { FOOT_LABELS, TRUSS_LABELS } from "@/lib/constants"
import type { Support } from "@/lib/types-bridge"

function createSupport(index: number): Support {
  return {
    id: crypto.randomUUID(),
    label: `Stuetze ${index + 1}`,
    position: { x: 0, y: 0 },
    trussType: "PROLYTE_H30V",
    height: 6,
    footType: "BASEPLATE",
    baseplateSize: 0.6,
    outriggerLength: 0,
    existingBallast: 0,
  }
}

export function SupportList({
  supports,
  onChange,
}: {
  supports: Support[]
  onChange: (supports: Support[]) => void
}) {
  const [draft, setDraft] = useState<Support | null>(null)
  const [open, setOpen] = useState(false)

  const emptyStateText = useMemo(
    () =>
      supports.length === 0
        ? "Noch keine Stuetzen erfasst. Lege zuerst die Grundrisspunkte an."
        : `${supports.length} Stuetzen im aktuellen Modell.`,
    [supports.length],
  )

  const openCreate = () => {
    setDraft(createSupport(supports.length))
    setOpen(true)
  }

  const openEdit = (support: Support) => {
    setDraft(support)
    setOpen(true)
  }

  const saveSupport = (nextSupport: Support) => {
    const exists = supports.some((support) => support.id === nextSupport.id)
    onChange(
      exists
        ? supports.map((support) => (support.id === nextSupport.id ? nextSupport : support))
        : [...supports, nextSupport],
    )
    setOpen(false)
  }

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Stuetzen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {emptyStateText}
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus />
          Stuetze hinzufuegen
        </Button>
      </div>

      <div className="mt-5 hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[780px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border">
              <th className="pb-3 font-medium">Label</th>
              <th className="pb-3 font-medium">X (m)</th>
              <th className="pb-3 font-medium">Y (m)</th>
              <th className="pb-3 font-medium">Hoehe (m)</th>
              <th className="pb-3 font-medium">Typ</th>
              <th className="pb-3 font-medium">Fuss</th>
              <th className="pb-3 font-medium">Ballast vorhanden (kg)</th>
              <th className="pb-3 font-medium text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {supports.map((support) => (
              <tr key={support.id} className="border-b border-border/70">
                <td className="py-3 font-medium">{support.label}</td>
                <td className="py-3">{support.position.x.toFixed(2)}</td>
                <td className="py-3">{support.position.y.toFixed(2)}</td>
                <td className="py-3">{support.height.toFixed(2)}</td>
                <td className="py-3">{TRUSS_LABELS[support.trussType]}</td>
                <td className="py-3">{FOOT_LABELS[support.footType]}</td>
                <td className="py-3">{support.existingBallast.toFixed(0)}</td>
                <td className="py-3">
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="icon" onClick={() => openEdit(support)}>
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => onChange(supports.filter((item) => item.id !== support.id))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-3 lg:hidden">
        {supports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Noch keine Stuetzen angelegt.
          </div>
        ) : null}
        {supports.map((support) => (
          <article key={support.id} className="rounded-2xl border border-border bg-background/80 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold">{support.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {TRUSS_LABELS[support.trussType]} · {FOOT_LABELS[support.footType]}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => openEdit(support)}>
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => onChange(supports.filter((item) => item.id !== support.id))}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Position</dt>
                <dd>
                  {support.position.x.toFixed(2)} / {support.position.y.toFixed(2)} m
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Hoehe</dt>
                <dd>{support.height.toFixed(2)} m</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ballast</dt>
                <dd>{support.existingBallast.toFixed(0)} kg</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      {draft ? (
        <SupportForm
          key={draft.id}
          open={open}
          support={draft}
          onClose={() => setOpen(false)}
          onSave={saveSupport}
        />
      ) : null}
    </section>
  )
}
