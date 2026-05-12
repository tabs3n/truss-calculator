import type { KeyboardEvent } from "react"

import { compassAngleToVector, WIND_DIRECTION_OPTIONS } from "@/lib/constants"
import { cn } from "@/lib/utils"

function toggleAngle(selectedAngles: number[], angle: number) {
  const isSelected = selectedAngles.includes(angle)

  if (isSelected) {
    return selectedAngles.length > 1
      ? selectedAngles.filter((entry) => entry !== angle)
      : selectedAngles
  }

  return [...selectedAngles, angle].sort((left, right) => left - right)
}

export function WindCompass({
  selectedAngles,
  onChange,
}: {
  selectedAngles: number[]
  onChange: (next: number[]) => void
}) {
  const handleToggle = (angle: number) => {
    onChange(toggleAngle(selectedAngles, angle))
  }

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>, angle: number) => {
    if (event.key !== "Enter" && event.key !== " ") return

    event.preventDefault()
    handleToggle(angle)
  }

  return (
    <div className="rounded-[1.5rem] border border-border/80 bg-card/70 p-4 shadow-sm">
      <svg viewBox="0 0 184 184" className="mx-auto h-52 w-full max-w-[240px]" aria-label="Kompassrose für Windrichtungen">
        <defs>
          <marker id="wind-compass-arrow-muted" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
          </marker>
          <marker id="wind-compass-arrow-active" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#0284c7" />
          </marker>
        </defs>

        <circle cx="92" cy="92" r="68" className="fill-background stroke-border" strokeWidth="1.5" />
        <circle cx="92" cy="92" r="22" className="fill-muted/40 stroke-border/70" strokeWidth="1.5" />
        <path d="M92 26v132 M26 92h132" className="stroke-border/70" strokeWidth="1.5" />
        <path d="M44 44l96 96 M140 44l-96 96" className="stroke-border/50" strokeWidth="1.25" />
        <text x="92" y="97" textAnchor="middle" className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-[0.22em]">
          Wind
        </text>

        {WIND_DIRECTION_OPTIONS.map(({ angle, label }) => {
          const vector = compassAngleToVector(angle)
          const isSelected = selectedAngles.includes(angle)
          const tailX = 92 + vector.x * 24
          const tailY = 92 + vector.y * 24
          const headX = 92 + vector.x * 54
          const headY = 92 + vector.y * 54
          const labelX = 92 + vector.x * 73
          const labelY = 92 + vector.y * 73 + 4

          return (
            <g
              key={angle}
              role="button"
              tabIndex={0}
              aria-label={`${label} (${angle} Grad)`}
              aria-pressed={isSelected}
              onClick={() => handleToggle(angle)}
              onKeyDown={(event) => handleKeyDown(event, angle)}
              className={cn(
                "cursor-pointer outline-none transition-colors focus-visible:text-primary",
                isSelected ? "text-sky-600" : "text-slate-400 hover:text-slate-600",
              )}
            >
              <circle
                cx={92 + vector.x * 60}
                cy={92 + vector.y * 60}
                r="16"
                fill={isSelected ? "rgba(37, 99, 235, 0.12)" : "transparent"}
              />
              <line
                x1={tailX}
                y1={tailY}
                x2={headX}
                y2={headY}
                stroke="currentColor"
                strokeWidth={isSelected ? "4" : "2.5"}
                strokeLinecap="round"
                markerEnd={isSelected ? "url(#wind-compass-arrow-active)" : "url(#wind-compass-arrow-muted)"}
              />
              <text x={labelX} y={labelY} textAnchor="middle" className="fill-current text-[12px] font-semibold">
                {label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
