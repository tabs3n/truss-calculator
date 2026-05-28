import type { Beam, StructureInput, Support } from './types'

export interface ValidationIssue {
  field: string
  severity: 'error' | 'warning'
  message: string
  suggestion?: string
}

function issue(
  field: string,
  severity: ValidationIssue['severity'],
  message: string,
  suggestion?: string,
): ValidationIssue {
  return suggestion ? { field, severity, message, suggestion } : { field, severity, message }
}

function getBeamSupportIds(beam: Beam): string[] {
  return beam.supportIds && beam.supportIds.length >= 2
    ? beam.supportIds
    : [beam.startSupportId, beam.endSupportId]
}

function getSupportById(supports: Support[], supportId: string): Support | undefined {
  return supports.find(support => support.id === supportId)
}

function getBeamSpanLengthM(beam: Beam, supports: Support[]): number {
  const supportIds = getBeamSupportIds(beam)
  let lengthM = 0

  for (let index = 0; index < supportIds.length - 1; index += 1) {
    const start = getSupportById(supports, supportIds[index]!)
    const end = getSupportById(supports, supportIds[index + 1]!)
    if (!start || !end) return 0
    lengthM += Math.hypot(end.position.x - start.position.x, end.position.y - start.position.y)
  }

  return lengthM
}

function validateSupports(input: StructureInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const positions = new Map<string, string>()

  input.supports.forEach((support, index) => {
    const prefix = `supports.${index}`
    if (!Number.isFinite(support.height) || support.height < 0.5 || support.height > 20) {
      issues.push(issue(
        `${prefix}.height`,
        'error',
        'Höhe muss zwischen 0,5 und 20 m liegen.',
        'Typische Groundsupport-Höhen liegen bei 4 bis 8 m.',
      ))
    }

    if (!Number.isFinite(support.position.x) || !Number.isFinite(support.position.y)) {
      issues.push(issue(
        `${prefix}.position`,
        'error',
        'Stützenposition muss aus gültigen X/Y-Koordinaten bestehen.',
      ))
    }

    const positionKey = `${support.position.x.toFixed(3)}:${support.position.y.toFixed(3)}`
    const existingSupportId = positions.get(positionKey)
    if (existingSupportId) {
      issues.push(issue(
        `${prefix}.position`,
        'error',
        `Stütze steht auf derselben Position wie ${existingSupportId}.`,
        'Eine der Stützen im Grundriss verschieben.',
      ))
    } else {
      positions.set(positionKey, support.label || support.id)
    }

    if (support.footType === 'BASEPLATE' && (support.outriggerLength ?? 0) > 3) {
      issues.push(issue(
        `${prefix}.outriggerLength`,
        'warning',
        'Outrigger-Länge über 3 m wirkt ungewöhnlich groß.',
        'Geometrie und realen Hebelarm prüfen.',
      ))
    }
  })

  return issues
}

function validateBeams(input: StructureInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  input.beams.forEach((beam, index) => {
    const prefix = `beams.${index}`
    const spanLengthM = getBeamSpanLengthM(beam, input.supports)
    const minPositionM = -beam.cantileverStart
    const maxPositionM = spanLengthM + beam.cantileverEnd
    const beamSupports = getBeamSupportIds(beam)
      .map(supportId => getSupportById(input.supports, supportId))
      .filter((support): support is Support => Boolean(support))
    const maxMountHeightM = beamSupports.length > 0
      ? Math.min(...beamSupports.map(support => support.height))
      : 0

    if (spanLengthM <= 0) {
      issues.push(issue(
        `${prefix}.supports`,
        'error',
        'Traverse benötigt mindestens zwei gültige Stützen mit Abstand.',
      ))
      return
    }

    if (spanLengthM > 12) {
      issues.push(issue(
        `${prefix}.span`,
        'warning',
        'Freie Spannweite über 12 m ist für Traversensysteme kritisch.',
        'Zwischenstütze, größeren Traversentyp oder Herstellerstatik prüfen.',
      ))
    }

    if (beam.trussType === 'PROLYTE_H30V' && spanLengthM > 8) {
      issues.push(issue(
        `${prefix}.span`,
        'warning',
        'PROLYTE_H30V erlaubt typischerweise maximal ca. 8 m frei.',
        'H40V oder zusätzliche Stütze prüfen.',
      ))
    }

    if (beam.cantileverStart > spanLengthM / 2) {
      issues.push(issue(
        `${prefix}.cantileverStart`,
        'warning',
        'Linke Auskragung ist größer als die halbe Spannweite.',
        'Kragarm verkürzen oder zusätzliche Stütze setzen.',
      ))
    }

    if (beam.cantileverEnd > spanLengthM / 2) {
      issues.push(issue(
        `${prefix}.cantileverEnd`,
        'warning',
        'Rechte Auskragung ist größer als die halbe Spannweite.',
        'Kragarm verkürzen oder zusätzliche Stütze setzen.',
      ))
    }

    if (beam.mountHeightM !== undefined) {
      if (!Number.isFinite(beam.mountHeightM) || beam.mountHeightM < 0) {
        issues.push(issue(
          `${prefix}.mountHeightM`,
          'error',
          'Montagehöhe muss größer oder gleich 0 m sein.',
        ))
      } else if (beam.mountHeightM > maxMountHeightM) {
        issues.push(issue(
          `${prefix}.mountHeightM`,
          'error',
          `Montagehöhe darf die niedrigste Stütze (${maxMountHeightM.toFixed(2)} m) nicht überschreiten.`,
          'Für Kopftraversen das Feld leer lassen, für Untertraversen z.B. 0,45 m eintragen.',
        ))
      }
    }

    const distributedLoads = beam.distributedLoads ?? []
    distributedLoads.forEach((load, loadIndex) => {
      if (load.endPositionM <= load.startPositionM) {
        issues.push(issue(
          `${prefix}.distributedLoads.${loadIndex}`,
          'error',
          'Streckenlast-Ende muss größer als der Start sein.',
        ))
      }
      if (load.startPositionM < minPositionM || load.endPositionM > maxPositionM) {
        issues.push(issue(
          `${prefix}.distributedLoads.${loadIndex}`,
          'error',
          `Streckenlast muss im Bereich ${minPositionM.toFixed(2)} m bis ${maxPositionM.toFixed(2)} m liegen.`,
          'Start und Ende auf die reale Traversengeometrie begrenzen.',
        ))
      }
      if (load.loadKgPerM <= 0) {
        issues.push(issue(
          `${prefix}.distributedLoads.${loadIndex}.loadKgPerM`,
          'error',
          'Streckenlast muss größer als 0 kg/m sein.',
        ))
      }
    })
  })

  return issues
}

export function validateStructureInput(input: StructureInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (input.supports.length < 2) {
    issues.push(issue(
      'supports',
      'error',
      'Mindestens zwei Stützen sind erforderlich.',
      'Eine zweite Stütze hinzufügen oder Vorlage verwenden.',
    ))
  }

  issues.push(...validateSupports(input))
  issues.push(...validateBeams(input))

  return issues
}
