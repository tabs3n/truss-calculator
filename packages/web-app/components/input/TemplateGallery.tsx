"use client"

import { Boxes, Building2, Plus, RadioTower, Warehouse } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TEMPLATES } from "@/lib/templates"
import type { StructureInput } from "@/lib/types-bridge"
import { cn } from "@/lib/utils"

const TEMPLATE_ICONS: Record<string, typeof Building2> = {
  goalpost: Building2,
  "groundsupport-foh": Boxes,
  "concert-tower": RadioTower,
  "indoor-stage": Warehouse,
}

export function TemplateGallery({
  onSelect,
  onEmpty,
}: {
  onSelect: (input: StructureInput) => void
  onEmpty: () => void
}) {
  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Mit Vorlage starten oder Felder direkt ausfüllen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Häufige Setups werden mit Stützen, Traversen, Windflächen und Reibwert vorbelegt.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onEmpty}>
          <Plus />
          Leere Konfiguration
        </Button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {TEMPLATES.map((template) => {
          const Icon = TEMPLATE_ICONS[template.id] ?? Building2

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template.buildInput())}
              className={cn(
                "group flex h-full min-h-36 flex-col rounded-2xl border border-border bg-background p-4 text-left shadow-sm transition-colors",
                "hover:border-primary/60 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors group-hover:border-primary/50">
                <Icon className="h-5 w-5" />
              </span>
              <span className="mt-4 text-sm font-semibold text-foreground">{template.label}</span>
              <span className="mt-2 text-sm leading-6 text-muted-foreground">{template.description}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
