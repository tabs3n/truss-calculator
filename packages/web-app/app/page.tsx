import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { COMPANY } from "@/lib/constants"

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border/70 bg-card/90 shadow-xl shadow-black/5 backdrop-blur">
        <div className="grid gap-8 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-12 lg:py-14">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Groundsupport Planung
            </span>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Truss Calculator für schnelle Standsicherheits-Vorbereitung im Tagesgeschäft.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Erfasse Stützen, Traversen, Hängelasten und Windflächen in einer
                gemeinsamen Arbeitsoberfläche. Die Rechenlogik wird spaeter direkt an die
                `calc-engine` angebunden.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/calculator" className={buttonVariants({ className: "h-11 px-5 text-sm font-semibold" })}>
                Zum Rechner
              </Link>
              <a
                href="https://vercel.com"
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({
                  variant: "outline",
                  className: "h-11 px-5 text-sm font-semibold",
                })}
              >
                Deploy-Ziel: Vercel
              </a>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-border/80 bg-muted/40 p-6">
            <p className="text-sm font-medium text-muted-foreground">Betreiber</p>
            <h2 className="mt-2 text-2xl font-semibold">{COMPANY.name}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{COMPANY.address}</p>
            <div className="mt-6 grid gap-3 text-sm">
              <div className="rounded-2xl border border-border/80 bg-background/90 p-4">
                Eingaben, Visualisierung und Ergebnisbereich sind bereits getrennt angelegt.
              </div>
              <div className="rounded-2xl border border-border/80 bg-background/90 p-4">
                Die Berechnung nutzt bis zur Anbindung der `calc-engine` bewusst einen
                Platzhalter.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
