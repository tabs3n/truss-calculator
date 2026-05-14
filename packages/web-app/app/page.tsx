import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Gauge,
  LayoutTemplate,
  ScrollText,
  Wind,
  Wrench,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { COMPANY } from "@/lib/constants"
import { cn } from "@/lib/utils"

const FEATURES = [
  {
    icon: Wind,
    title: "Windlast nach DIN EN 1991-1-4",
    description:
      "Geländekategorie, Windzone und Böengeschwindigkeitsdruck qp(z) — automatisch nach Eurocode, plus richtungsabhängige Flächenlasten je Banner und LED-Wand.",
  },
  {
    icon: Gauge,
    title: "Kipp- & Gleitnachweis (EQU)",
    description:
      "Lagesicherheit nach DIN EN 1990 mit γG,inf = 0,90 stabilisierend und γQ × Dyn = 1,80 destabilisierend. Reibwerte nach DIN EN 13814 Tab. 3.",
  },
  {
    icon: Wrench,
    title: "Multi-Support & Streckenlasten",
    description:
      "Traversen mit beliebigen Zwischenstützen, Punktlasten und kg/m-Streckenlasten. Eigengewicht inkl. 5 % Verbinder.",
  },
  {
    icon: LayoutTemplate,
    title: "Vorlagen für typische Setups",
    description:
      "2-Stützen-Goalpost, 4-Stützen-FOH, Tower mit Concrete Blocks, Indoor-Bühne — ein Klick und du kannst loslegen.",
  },
  {
    icon: FileText,
    title: "PDF-Report mit Normen-Spur",
    description:
      "Vollständiger Planungsbericht mit Isometrie, Grundriss, Formeln, Bemessungswerten und Ballast-Tabelle pro Stütze. Druckfertig, signaturbereit.",
  },
  {
    icon: CheckCircle2,
    title: "Automatische Empfehlungen",
    description:
      "Erkennt klassische Schwachstellen wie fehlende Outrigger oder kritische Windrichtungen — mit konkreter Ballast-Ersparnis-Schätzung.",
  },
]

const NORMS = [
  "DIN EN 1991-1-4 (Windlasten)",
  "DIN EN 1990 (γ-Faktoren)",
  "DIN EN 17879 (Event-Strukturen)",
  "DIN EN 13814 (Reibung)",
  "DIN EN 1999-1-1 (EC9 Knicken)",
  "DGUV 215-313 (Dynamik 1,20)",
]

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        {/* ───────────── HERO ───────────── */}
        <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/90 shadow-xl shadow-black/5 backdrop-blur">
          <div className="grid gap-10 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-[1.25fr_0.75fr] lg:px-14 lg:py-16">
            <div className="space-y-7">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Planungswerkzeug für Veranstaltungstechnik
              </span>

              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Standsicherheit für Truss-Konstruktionen — in Minuten, nicht Stunden.
              </h1>

              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Erfasse Stützen, Traversen, Hängelasten und Windflächen, lass den Kipp-, Gleit- und
                Knicknachweis nach europäischer Norm rechnen und exportiere einen vollständigen
                Planungsreport als PDF — mit Skizzen, Formeln und Ballast-Verteilung.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/calculator"
                  className={buttonVariants({ className: "h-12 px-6 text-sm font-semibold" })}
                >
                  Rechner öffnen
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <span className="text-xs text-muted-foreground">
                  Keine Anmeldung. Eingaben werden lokal im Browser gespeichert.
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {NORMS.map((norm) => (
                  <span
                    key={norm}
                    className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {norm}
                  </span>
                ))}
              </div>
            </div>

            <aside className="rounded-[1.5rem] border border-border/80 bg-gradient-to-br from-muted/60 to-muted/20 p-6 lg:p-7">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <ScrollText className="h-3.5 w-3.5" />
                Betreiber
              </div>
              <h2 className="mt-3 text-2xl font-semibold leading-tight">{COMPANY.name}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{COMPANY.address}</p>

              <div className="mt-6 space-y-3 text-sm">
                <div className="rounded-2xl border border-border/80 bg-background/90 p-4">
                  <p className="font-semibold">Für die Fachkraft Veranstaltungstechnik.</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-5">
                    Konservative Bemessung nach DIN EN — geeignet als Planungsgrundlage und
                    als Diskussionsbasis mit dem prüfenden Statiker.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-background/90 p-4">
                  <p className="font-semibold">Kein geprüfter Standsicherheitsnachweis.</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-5">
                    Die rechtliche Verantwortung für die Ausführung liegt beim Betreiber.
                    Bei kritischen Aufbauten zusätzlich prüfen lassen.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* ───────────── FEATURES ───────────── */}
        <section>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Funktionsumfang
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Vom Grundriss bis zum signierten Bericht.
              </h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <article
                  key={feature.title}
                  className={cn(
                    "group rounded-2xl border border-border/70 bg-card/80 p-5 transition-all",
                    "hover:border-foreground/30 hover:shadow-md",
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/5 text-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                </article>
              )
            })}
          </div>
        </section>

        {/* ───────────── WORKFLOW ───────────── */}
        <section className="rounded-[2rem] border border-border/70 bg-card/80 px-6 py-8 sm:px-10 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Arbeitsfluss
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            In vier Schritten zum Planungsreport.
          </h2>

          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "1",
                title: "Vorlage wählen",
                description: "Goalpost, FOH, Tower oder Indoor — oder leer starten.",
              },
              {
                step: "2",
                title: "Konfiguration anpassen",
                description: "Stützen, Traversen, Lasten und Windflächen ergänzen oder ändern.",
              },
              {
                step: "3",
                title: "Berechnen",
                description: "Wind, Kippen, Gleiten, Knicken — alle vier Hauptwindrichtungen.",
              },
              {
                step: "4",
                title: "PDF exportieren",
                description: "Vollständiger Report mit Skizzen, Formeln und Ballast pro Stütze.",
              },
            ].map((item) => (
              <li key={item.step} className="relative rounded-2xl border border-border/70 bg-background/80 p-5">
                <span className="absolute -top-3 left-5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                  {item.step}
                </span>
                <h3 className="mt-2 text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </li>
            ))}
          </ol>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Bereit für das nächste Projekt?
            </p>
            <Link
              href="/calculator"
              className={buttonVariants({ className: "h-11 px-5 text-sm font-semibold" })}
            >
              Jetzt starten
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </section>

        <footer className="pb-4 text-center text-xs text-muted-foreground">
          {COMPANY.name} · {COMPANY.address}
        </footer>
      </div>
    </main>
  )
}
