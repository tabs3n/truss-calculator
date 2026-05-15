import type { CalculationResult, StructureInput, Support, WindSurface } from './types'
import { calculate } from './index'

export interface Variant {
  label: string
  description: string
  transform: (input: StructureInput) => StructureInput
}

export interface VariantResult {
  variant: Variant
  result: CalculationResult
}

function withUpdatedSupports(
  input: StructureInput,
  update: (support: Support) => Support,
): StructureInput {
  return {
    ...input,
    supports: input.supports.map(update),
  }
}

function makeMeshSurface(surface: WindSurface): WindSurface {
  if (surface.surfaceType !== 'BANNER_SOLID' && surface.surfaceType !== 'LED_WALL') return surface
  return {
    ...surface,
    surfaceType: 'BANNER_MESH_OPEN',
    dragCoefficient: 0.3,
  }
}

export const STANDARD_VARIANTS: Variant[] = [
  {
    label: 'Mit Outrigger 1,5 m',
    description: 'Alle Bodenplatten-Stützen erhalten einen wirksamen Outrigger-Hebelarm von mindestens 1,5 m.',
    transform: input =>
      withUpdatedSupports(input, support =>
        support.footType === 'BASEPLATE'
          ? { ...support, outriggerLength: Math.max(support.outriggerLength ?? 0, 1.5) }
          : support,
      ),
  },
  {
    label: 'Mit Concrete Blocks',
    description: 'Bodenplatten werden durch 1250-kg-Concrete-Blocks ersetzt, deren Eigengewicht stabilisierend zählt.',
    transform: input =>
      withUpdatedSupports(input, support =>
        support.footType === 'BASEPLATE'
          ? { ...support, footType: 'CONCRETE_BLOCK_1250', numberOfConcreteBlocks: 1 }
          : support,
      ),
  },
  {
    label: 'Reibwert Gummi/Beton',
    description: 'Der Gleitnachweis wird mit μ = 0,70 für Gummi auf Beton nach DIN EN 13814 geführt.',
    transform: input => ({
      ...input,
      frictionConfig: { mode: 'PRESET', preset: 'RUBBER_ON_CONCRETE' },
    }),
  },
  {
    label: 'Banner als offenes Mesh',
    description: 'Massive Banner-/LED-Flächen werden als sehr offenes Mesh mit cf = 0,3 angesetzt.',
    transform: input => ({
      ...input,
      beams: input.beams.map(beam => ({
        ...beam,
        windSurfaces: beam.windSurfaces.map(makeMeshSurface),
      })),
    }),
  },
]

export function calculateVariants(
  input: StructureInput,
  variants: Variant[] = STANDARD_VARIANTS,
): VariantResult[] {
  return variants.map(variant => ({
    variant,
    result: calculate(variant.transform(input)),
  }))
}
