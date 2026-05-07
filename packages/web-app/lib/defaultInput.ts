import type { StructureInput } from "./types-bridge"

export const defaultInput: StructureInput = {
  projectName: "",
  eventName: "",
  location: "",
  date: new Date().toISOString().split("T")[0],
  preparedBy: "",
  windZone: 2,
  terrainCategory: "II",
  supports: [],
  beams: [],
  frictionCoefficient: 0.3,
}
