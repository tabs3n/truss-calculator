"use client"

import { useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"

import { BeamForm } from "@/components/input/BeamForm"
import { Button } from "@/components/ui/button"
import { TRUSS_LABELS } from "@/lib/constants"
import { getBeamDisplayHeightM } from "@/lib/frame-geometry"
import type { Beam, Support } from "@/lib/types-bridge"

function createBeam(index: number, supports: Support[]): Beam {
  return {
    id: crypto.randomUUID(),
    label: `Traverse ${index + 1}`,
    startSupportId: supports[0]?.id ?? "",
    endSupportId: supports[1]?.id ?? "",
    trussType: "PROLYTE_H30V",
    cantileverStart: 0,
    cantileverEnd: 0,
    loads: [],
    windSurfaces: [],
  }
}

function createLowerBeam(index: number, supports: Support[], beams: Beam[]): Beam {
  const referenceBeam = beams[0]

  return {
    id: crypto.randomUUID(),
    label: `Untertraverse ${index + 1}`,
    startSupportId: referenceBeam?.startSupportId ?? supports[0]?.id ?? "",
    endSupportId: referenceBeam?.endSupportId ?? supports[1]?.id ?? "",
    supportIds: referenceBeam?.supportIds,
    trussType: referenceBeam?.trussType ?? "PROLYTE_H30V",
    mountHeightM: 0.45,
    cantileverStart: 0,
    cantileverEnd: 0,
    loads: [],
    windSurfaces: [],
  }
}

function formatBeamHeight(beam: Beam, supports: Support[]) {
  if (beam.mountHeightM === undefined) return "Stützenkopf"
  const height = getBeamDisplayHeightM(beam, supports) ?? beam.mountHeightM
  return `${height.toFixed(2)} m`
}

export function BeamList({
  beams,
  supports,
  onChange,
}: {
  beams: Beam[]
  supports: Support[]
  onChange: (beams: Beam[]) => void
}) {
  const [draft, setDraft] = useState<Beam | null>(null)
  const [open, setOpen] = useState(false)

  const supportNameById = new Map(supports.map((support) => [support.id, support.label]))

  const openCreate = () => {
    setDraft(createBeam(beams.length, supports))
    setOpen(true)
  }

  const openEdit = (beam: Beam) => {
    setDraft(beam)
    setOpen(true)
  }

  const saveBeam = (nextBeam: Beam) => {
    const exists = beams.some((beam) => beam.id === nextBeam.id)
    onChange(exists ? beams.map((beam) => (beam.id === nextBeam.id ? nextBeam : beam)) : [...beams, nextBeam])
    setOpen(false)
  }

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Traversen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Verbinde Stützen, pflege Auskragungen und hangle Lastfälle direkt an.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={openCreate} disabled={supports.length < 2}>
            <Plus />
            Traverse hinzufuegen
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(createLowerBeam(beams.length, supports, beams))
              setOpen(true)
            }}
            disabled={supports.length < 2}
          >
            <Plus />
            Untertraverse
          </Button>
        </div>
      </div>

      {supports.length < 2 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Fuer neue Traversen werden zuerst mindestens zwei Stützen benötigt.
        </div>
      ) : null}

      <div className="mt-5 hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border">
              <th className="pb-3 font-medium">Label</th>
              <th className="pb-3 font-medium">Von</th>
              <th className="pb-3 font-medium">Bis</th>
              <th className="pb-3 font-medium">Typ</th>
              <th className="pb-3 font-medium">Höhe</th>
              <th className="pb-3 font-medium">Auskr. L</th>
              <th className="pb-3 font-medium">Auskr. R</th>
              <th className="pb-3 font-medium">Lasten</th>
              <th className="pb-3 font-medium text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {beams.map((beam) => (
              <tr key={beam.id} className="border-b border-border/70">
                <td className="py-3 font-medium">{beam.label}</td>
                <td className="py-3">{supportNameById.get(beam.startSupportId) ?? "Unbekannt"}</td>
                <td className="py-3">{supportNameById.get(beam.endSupportId) ?? "Unbekannt"}</td>
                <td className="py-3">{TRUSS_LABELS[beam.trussType]}</td>
                <td className="py-3">{formatBeamHeight(beam, supports)}</td>
                <td className="py-3">{beam.cantileverStart.toFixed(2)} m</td>
                <td className="py-3">{beam.cantileverEnd.toFixed(2)} m</td>
                <td className="py-3">
                  {beam.loads.length} Lasten · {beam.windSurfaces.length} Flächen
                </td>
                <td className="py-3">
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="icon" onClick={() => openEdit(beam)}>
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => onChange(beams.filter((item) => item.id !== beam.id))}
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
        {beams.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Noch keine Traversen angelegt.
          </div>
        ) : null}
        {beams.map((beam) => (
          <article key={beam.id} className="rounded-2xl border border-border bg-background/80 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold">{beam.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{TRUSS_LABELS[beam.trussType]}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => openEdit(beam)}>
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => onChange(beams.filter((item) => item.id !== beam.id))}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Von / Bis</dt>
                <dd>
                  {supportNameById.get(beam.startSupportId) ?? "Unbekannt"} →{" "}
                  {supportNameById.get(beam.endSupportId) ?? "Unbekannt"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Auskragungen</dt>
                <dd>
                  {beam.cantileverStart.toFixed(2)} / {beam.cantileverEnd.toFixed(2)} m
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Höhe</dt>
                <dd>{formatBeamHeight(beam, supports)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Lasten</dt>
                <dd>{beam.loads.length}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Windflächen</dt>
                <dd>{beam.windSurfaces.length}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      {draft ? (
        <BeamForm
          key={draft.id}
          open={open}
          beam={draft}
          allBeams={beams}
          supports={supports}
          onClose={() => setOpen(false)}
          onSave={saveBeam}
        />
      ) : null}
    </section>
  )
}
