import type { CalculationResult } from "@/lib/types-bridge"

export function BallastTable({ result }: { result: CalculationResult | null }) {
  if (!result) {
    return (
      <div className="rounded-[1.5rem] border border-dashed p-4 text-sm text-muted-foreground">
        Ballasttabelle erscheint nach der Berechnung.
      </div>
    )
  }

  return (
    <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Ballast je Stütze</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Zeilen mit Zusatzbedarf sind gelb markiert.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border">
              <th className="pb-3 font-medium">Stütze</th>
              <th className="pb-3 font-medium">Vorhanden</th>
              <th className="pb-3 font-medium">Zusatzbedarf</th>
              <th className="pb-3 font-medium">Nach Ergänzung</th>
            </tr>
          </thead>
          <tbody>
            {result.ballastPerSupport.map((entry) => (
              <tr
                key={entry.supportId}
                className={`border-b border-border/70 ${
                  entry.additionalBallastNeededKg > 0 ? "bg-amber-50/70" : ""
                }`}
              >
                <td className="py-3 font-medium">{entry.supportLabel}</td>
                <td className="py-3">{entry.existingBallastKg.toFixed(0)} kg</td>
                <td className="py-3 font-semibold">
                  {entry.additionalBallastNeededKg.toFixed(0)} kg
                </td>
                <td className="py-3">
                  {(entry.existingBallastKg + entry.additionalBallastNeededKg).toFixed(0)} kg
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
