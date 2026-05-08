import type { StructureInput } from "./types-bridge"

export const defaultInput: StructureInput = {
  projectName: "",
  eventName: "",
  location: "",
  date: new Date().toISOString().split("T")[0],
  preparedBy: "",
  windZone: 2,
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
    mode: "CUSTOM",
    customValue: 0.3,
  },
}
