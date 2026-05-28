import type { Beam, StructureInput, Support, WindSurface } from "./types-bridge"

export interface Template {
  id: string
  label: string
  description: string
  buildInput: () => StructureInput
}

const DRAG_COEFFICIENTS: Record<WindSurface["surfaceType"], number> = {
  LED_WALL: 1.3,
  BANNER_SOLID: 1.3,
  BANNER_MESH: 0.6,
  BANNER_MESH_OPEN: 0.3,
  CUSTOM: 1.3,
}

function todayIsoDate() {
  return new Date().toISOString().split("T")[0] ?? ""
}

export function createEmptyInput(): StructureInput {
  return {
    projectName: "",
    eventName: "",
    location: "",
    date: todayIsoDate(),
    preparedBy: "",
    windZone: 1,
    terrainCategory: "II",
    windMode: "AUTO",
    manualWindDirections: [],
    environment: "OUTDOOR",
    indoorConfig: {
      doorsCanOpen: false,
    },
    supports: [],
    beams: [],
    frictionConfig: {
      mode: "PRESET",
      preset: "RUBBER_ON_CONCRETE",
    },
  }
}

function createOutdoorBase(projectName: string): StructureInput {
  return {
    ...createEmptyInput(),
    projectName,
    environment: "OUTDOOR",
  }
}

function createWindSurface(
  label: string,
  width: number,
  height: number,
  centerHeightAboveGround: number,
  surfaceType: WindSurface["surfaceType"],
  surfaceOrientationDeg = 0,
): WindSurface {
  return {
    id: crypto.randomUUID(),
    label,
    width,
    height,
    centerHeightAboveGround,
    surfaceType,
    surfaceOrientationDeg,
    dragCoefficient: DRAG_COEFFICIENTS[surfaceType],
  }
}

function createHangingLoad(label: string, positionAlongBeam: number, weight: number) {
  return {
    id: crypto.randomUUID(),
    label,
    positionAlongBeam,
    weight,
  }
}

function createGoalpostTemplate(): StructureInput {
  const leftSupportId = crypto.randomUUID()
  const rightSupportId = crypto.randomUUID()
  const topBeamId = crypto.randomUUID()
  const bottomBeamId = crypto.randomUUID()

  const supports: Support[] = [
    {
      id: leftSupportId,
      label: "Stütze links",
      position: { x: 0, y: 0 },
      trussType: "PROLYTE_H30V",
      height: 5,
      footType: "BASEPLATE",
      baseplateSize: 0.6,
      outriggerLength: 1.2,
      existingBallast: 0,
    },
    {
      id: rightSupportId,
      label: "Stütze rechts",
      position: { x: 8, y: 0 },
      trussType: "PROLYTE_H30V",
      height: 5,
      footType: "BASEPLATE",
      baseplateSize: 0.6,
      outriggerLength: 1.2,
      existingBallast: 0,
    },
  ]

  const beams: Beam[] = [
    {
      id: topBeamId,
      label: "Kopftraverse",
      startSupportId: leftSupportId,
      endSupportId: rightSupportId,
      trussType: "PROLYTE_H30V",
      cantileverStart: 0,
      cantileverEnd: 0,
      loads: [],
      windSurfaces: [
        {
          ...createWindSurface("Banner im Rahmen", 7.9, 4.4, 2.75, "BANNER_SOLID", 0),
          frameMode: "FILL_TRUSS_FRAME",
          bottomBeamId,
          edgeInsetM: 0.05,
        },
      ],
    },
    {
      id: bottomBeamId,
      label: "Untertraverse",
      startSupportId: leftSupportId,
      endSupportId: rightSupportId,
      trussType: "PROLYTE_H30V",
      mountHeightM: 0.45,
      cantileverStart: 0,
      cantileverEnd: 0,
      loads: [],
      windSurfaces: [],
    },
  ]

  return {
    ...createOutdoorBase("2-Stützen-Goalpost"),
    supports,
    beams,
  }
}

function createGroundsupportTemplate(): StructureInput {
  const frontLeftId = crypto.randomUUID()
  const frontRightId = crypto.randomUUID()
  const backRightId = crypto.randomUUID()
  const backLeftId = crypto.randomUUID()

  const supports: Support[] = [
    {
      id: frontLeftId,
      label: "FOH vorne links",
      position: { x: 0, y: 0 },
      trussType: "PROLYTE_H40V",
      height: 6,
      footType: "BASEPLATE",
      baseplateSize: 0.6,
      outriggerLength: 1.5,
      existingBallast: 0,
    },
    {
      id: frontRightId,
      label: "FOH vorne rechts",
      position: { x: 6, y: 0 },
      trussType: "PROLYTE_H40V",
      height: 6,
      footType: "BASEPLATE",
      baseplateSize: 0.6,
      outriggerLength: 1.5,
      existingBallast: 0,
    },
    {
      id: backRightId,
      label: "FOH hinten rechts",
      position: { x: 6, y: 4 },
      trussType: "PROLYTE_H40V",
      height: 6,
      footType: "BASEPLATE",
      baseplateSize: 0.6,
      outriggerLength: 1.5,
      existingBallast: 0,
    },
    {
      id: backLeftId,
      label: "FOH hinten links",
      position: { x: 0, y: 4 },
      trussType: "PROLYTE_H40V",
      height: 6,
      footType: "BASEPLATE",
      baseplateSize: 0.6,
      outriggerLength: 1.5,
      existingBallast: 0,
    },
  ]

  const beams: Beam[] = [
    {
      id: crypto.randomUUID(),
      label: "FOH Fronttraverse",
      startSupportId: frontLeftId,
      endSupportId: frontRightId,
      trussType: "PROLYTE_H40V",
      cantileverStart: 0,
      cantileverEnd: 0,
      loads: [],
      windSurfaces: [
        createWindSurface("LED-Wand", 6, 4, 3, "LED_WALL", 0),
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "FOH Rechtstraverse",
      startSupportId: frontRightId,
      endSupportId: backRightId,
      trussType: "PROLYTE_H40V",
      cantileverStart: 0,
      cantileverEnd: 0,
      loads: [],
      windSurfaces: [],
    },
    {
      id: crypto.randomUUID(),
      label: "FOH Backtraverse",
      startSupportId: backLeftId,
      endSupportId: backRightId,
      trussType: "PROLYTE_H40V",
      cantileverStart: 0,
      cantileverEnd: 0,
      loads: [],
      windSurfaces: [],
    },
    {
      id: crypto.randomUUID(),
      label: "FOH Linkstraverse",
      startSupportId: frontLeftId,
      endSupportId: backLeftId,
      trussType: "PROLYTE_H40V",
      cantileverStart: 0,
      cantileverEnd: 0,
      loads: [],
      windSurfaces: [],
    },
  ]

  return {
    ...createOutdoorBase("4-Stützen-Groundsupport FOH"),
    supports,
    beams,
  }
}

function createConcertTowerTemplate(): StructureInput {
  const leftTowerId = crypto.randomUUID()
  const rightTowerId = crypto.randomUUID()

  const supports: Support[] = [
    {
      id: leftTowerId,
      label: "Tower links",
      position: { x: 0, y: 0 },
      trussType: "PROLYTE_H40V",
      height: 8,
      footType: "CONCRETE_BLOCK_1250",
      existingBallast: 0,
      numberOfConcreteBlocks: 2,
    },
    {
      id: rightTowerId,
      label: "Tower rechts",
      position: { x: 6, y: 0 },
      trussType: "PROLYTE_H40V",
      height: 8,
      footType: "CONCRETE_BLOCK_1250",
      existingBallast: 0,
      numberOfConcreteBlocks: 2,
    },
  ]

  const beams: Beam[] = [
    {
      id: crypto.randomUUID(),
      label: "Konzerttraverse",
      startSupportId: leftTowerId,
      endSupportId: rightTowerId,
      trussType: "PROLYTE_H40V",
      cantileverStart: 0,
      cantileverEnd: 0,
      loads: [
        createHangingLoad("Movinglight 1", 1.2, 30),
        createHangingLoad("Movinglight 2", 2.4, 30),
        createHangingLoad("Movinglight 3", 3.6, 30),
        createHangingLoad("Movinglight 4", 4.8, 30),
      ],
      windSurfaces: [],
    },
  ]

  return {
    ...createOutdoorBase("Tower mit Konzertbestückung"),
    supports,
    beams,
  }
}

function createIndoorStageTemplate(): StructureInput {
  const frontLeftId = crypto.randomUUID()
  const frontRightId = crypto.randomUUID()
  const backRightId = crypto.randomUUID()
  const backLeftId = crypto.randomUUID()

  const supports: Support[] = [
    {
      id: frontLeftId,
      label: "Bühne vorne links",
      position: { x: 0, y: 0 },
      trussType: "PROLYTE_H30V",
      height: 4,
      footType: "BASEPLATE",
      baseplateSize: 0.6,
      existingBallast: 0,
    },
    {
      id: frontRightId,
      label: "Bühne vorne rechts",
      position: { x: 6, y: 0 },
      trussType: "PROLYTE_H30V",
      height: 4,
      footType: "BASEPLATE",
      baseplateSize: 0.6,
      existingBallast: 0,
    },
    {
      id: backRightId,
      label: "Bühne hinten rechts",
      position: { x: 6, y: 4 },
      trussType: "PROLYTE_H30V",
      height: 4,
      footType: "BASEPLATE",
      baseplateSize: 0.6,
      existingBallast: 0,
    },
    {
      id: backLeftId,
      label: "Bühne hinten links",
      position: { x: 0, y: 4 },
      trussType: "PROLYTE_H30V",
      height: 4,
      footType: "BASEPLATE",
      baseplateSize: 0.6,
      existingBallast: 0,
    },
  ]

  const beams: Beam[] = [
    {
      id: crypto.randomUUID(),
      label: "Fronttraverse",
      startSupportId: frontLeftId,
      endSupportId: frontRightId,
      trussType: "PROLYTE_H30V",
      cantileverStart: 0,
      cantileverEnd: 0,
      loads: [],
      windSurfaces: [],
    },
    {
      id: crypto.randomUUID(),
      label: "Backtraverse",
      startSupportId: backLeftId,
      endSupportId: backRightId,
      trussType: "PROLYTE_H30V",
      cantileverStart: 0,
      cantileverEnd: 0,
      loads: [],
      windSurfaces: [],
    },
  ]

  return {
    ...createEmptyInput(),
    projectName: "Indoor-Bühne",
    environment: "INDOOR",
    indoorConfig: {
      doorsCanOpen: false,
    },
    supports,
    beams,
  }
}

export const TEMPLATES: Template[] = [
  {
    id: "goalpost",
    label: "2-Stützen-Goalpost",
    description: "8 m Kopftraverse, 5 m Stützenhöhe und mittiges 6 × 3 m Banner.",
    buildInput: createGoalpostTemplate,
  },
  {
    id: "groundsupport-foh",
    label: "4-Stützen-Groundsupport",
    description: "FOH-Rahmen 6 × 4 m mit H40V und 6 × 4 m LED-Wand.",
    buildInput: createGroundsupportTemplate,
  },
  {
    id: "concert-tower",
    label: "Tower mit Konzertbestückung",
    description: "6 m Konzerttraverse auf Betonblöcken mit vier 30-kg-Hängelasten.",
    buildInput: createConcertTowerTemplate,
  },
  {
    id: "indoor-stage",
    label: "Indoor-Bühne",
    description: "Vier H30V-Stützen, zwei Traversen und Indoor-Ersatzlast ohne offene Tore.",
    buildInput: createIndoorStageTemplate,
  },
]
