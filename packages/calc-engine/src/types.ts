/**
 * truss-calculator – Shared Types
 * packages/calc-engine/src/types.ts
 *
 * DIESER FILE IST DER VERTRAG ZWISCHEN calc-engine UND web-app.
 * Änderungen hier erfordern Abstimmung zwischen Claude Code und Codex.
 */

// ─────────────────────────────────────────────
// ENUMS & LITERAL TYPES
// ─────────────────────────────────────────────

export type TrussType =
  | 'PROLYTE_H30D'
  | 'PROLYTE_H30V'
  | 'PROLYTE_H40V'
  | 'PROLYTE_S40T'
  | 'PROLYTE_S52F'
  | 'EUROTRUSS_TD44'
  | 'EUROTRUSS_ST50'
  | 'PIPE_48_3_STEEL'   // Ø48.3×3.2 S235 – Standard-Stahlrohr
  | 'PIPE_50_3_ALU'     // Ø50×3 EN AW 6082-T6

export type WindZone = 1 | 2 | 3 | 4

export type TerrainCategory = 'I' | 'II' | 'III' | 'IV'

export type FootType =
  | 'BASEPLATE'            // Bodenplatte, Ballast wird obendrauf gestellt
  | 'CONCRETE_BLOCK_1250'  // Betonblock 1250 kg mit Traversenaufnahme
  | 'TRUSS_PLATE_30x30'    // Traversenplatte 30×30 cm (bei Groundsupports)

/** Reibwerte nach DIN EN 13814 Tabelle 3 */
export type FrictionPreset =
  | 'RUBBER_ON_CONCRETE'    // μ = 0.70
  | 'WOOD_ON_CONCRETE'      // μ = 0.60
  | 'WOOD_ON_WOOD'          // μ = 0.40
  | 'STEEL_ON_CONCRETE'     // μ = 0.20
  | 'STEEL_ON_STEEL'        // μ = 0.10
  | 'ALU_ON_CONCRETE'       // μ = 0.20
  | 'CONCRETE_ON_CONCRETE'  // μ = 0.50
  | 'WOOD_ON_GRAVEL'        // μ = 0.65
  | 'CUSTOM'

export interface FrictionConfig {
  mode: 'PRESET' | 'CUSTOM'
  preset?: FrictionPreset
  customValue?: number  // nur wenn mode = 'CUSTOM'
}

const FRICTION_PRESET_VALUES: Record<Exclude<FrictionPreset, 'CUSTOM'>, number> = {
  RUBBER_ON_CONCRETE:   0.70,
  WOOD_ON_CONCRETE:     0.60,
  WOOD_ON_WOOD:         0.40,
  STEEL_ON_CONCRETE:    0.20,
  STEEL_ON_STEEL:       0.10,
  ALU_ON_CONCRETE:      0.20,
  CONCRETE_ON_CONCRETE: 0.50,
  WOOD_ON_GRAVEL:       0.65,
}

/** Gibt den effektiven μ-Wert aus einer FrictionConfig zurück */
export function getFrictionCoefficient(config: FrictionConfig): number {
  if (config.mode === 'CUSTOM') {
    if (config.customValue === undefined || config.customValue <= 0 || config.customValue > 1) {
      throw new Error(`Ungültiger customValue: ${config.customValue} (muss 0 < μ ≤ 1)`)
    }
    return config.customValue
  }
  if (!config.preset || config.preset === 'CUSTOM') {
    throw new Error('FrictionConfig: mode ist PRESET aber kein gültiges preset angegeben')
  }
  return FRICTION_PRESET_VALUES[config.preset]
}

// ─────────────────────────────────────────────
// GEOMETRIE
// ─────────────────────────────────────────────

export interface Point2D {
  x: number  // Meter, Grundriss
  y: number  // Meter, Grundriss
}

// ─────────────────────────────────────────────
// LASTEN
// ─────────────────────────────────────────────

/** Einzellast die an einer Traverse hängt */
export interface HangingLoad {
  id: string
  label: string              // z.B. "Robe BMFL", "LED-Wand Panel"
  positionAlongBeam: number  // Meter vom linken Auflager
  weight: number             // kg (Nenngewicht, ohne Dynamikfaktor)
}

/** Windangriffsfläche (Banner, LED-Wand, bestückte Traverse) */
export interface WindSurface {
  id: string
  label: string                // z.B. "LED-Wand", "Banner"
  width: number                // m
  height: number               // m
  centerHeightAboveGround: number  // m – Höhe des Flächenschwerpunkts
  /** Oberflächentyp – bestimmt cf automatisch (außer CUSTOM) */
  surfaceType: 'LED_WALL' | 'BANNER_SOLID' | 'BANNER_MESH' | 'BANNER_MESH_OPEN' | 'CUSTOM'
  /**
   * Richtung des Normalenvektors der Fläche in Kompassgrad.
   * 0° = zeigt nach Nord/+Y, 90° = zeigt nach Ost/+X.
   * Volle Windlast wenn Windrichtung = surfaceOrientationDeg.
   */
  surfaceOrientationDeg: number
  /** cf nur bei surfaceType === 'CUSTOM' verwendet; für alle anderen Typen wird der Typ-Standardwert genutzt */
  dragCoefficient: number
}

// ─────────────────────────────────────────────
// STRUKTURELEMENTE
// ─────────────────────────────────────────────

/** Eine vertikale Stütze / ein Tower-Bein */
export interface Support {
  id: string
  label: string              // z.B. "Stütze A", "Tower Links"
  position: Point2D          // Grundrissposition in Metern
  trussType: TrussType       // Traversentyp der Stütze
  height: number             // m – Stützenhöhe
  footType: FootType
  /** Für BASEPLATE: Kantenlänge der Platte in m */
  baseplateSize?: number
  /** Für BASEPLATE: Outrigger-Länge in m (von Stützenmitte bis Plattenrand) */
  outriggerLength?: number
  /** Vorhandener Ballast (wird in Berechnung berücksichtigt) */
  existingBallast: number    // kg
  /**
   * Für CONCRETE_BLOCK_1250: Anzahl gestapelter Betonblöcke (Default 1).
   * Gesamtgewicht = numberOfConcreteBlocks × 1250 kg.
   */
  numberOfConcreteBlocks?: number
}

/** Eine horizontale Traverse zwischen zwei Stützen */
export interface Beam {
  id: string
  label: string
  startSupportId: string
  endSupportId: string
  trussType: TrussType
  /** Auskragung über die Stütze hinaus links (Richtung Start) */
  cantileverStart: number    // m, 0 wenn keine Auskragung
  /** Auskragung über die Stütze hinaus rechts (Richtung End) */
  cantileverEnd: number      // m, 0 wenn keine Auskragung
  loads: HangingLoad[]
  windSurfaces: WindSurface[]
}

// ─────────────────────────────────────────────
// HAUPTEINGABE
// ─────────────────────────────────────────────

export interface StructureInput {
  // Metadaten
  projectName: string
  eventName: string
  location: string
  date: string               // ISO 8601
  preparedBy: string         // Name der Fachkraft

  // Standort & Umgebung
  windZone: WindZone
  terrainCategory: TerrainCategory

  // Konstruktion
  supports: Support[]
  beams: Beam[]

  // Einsatzumgebung
  environment: 'OUTDOOR' | 'INDOOR'
  /**
   * Nur relevant wenn environment === 'INDOOR'.
   * doorsCanOpen: Ersatzflächenlast nach DIN EN 17879 nur bei offenen Toren ansetzen.
   */
  indoorConfig?: {
    doorsCanOpen: boolean
  }

  // Reibung
  frictionConfig: FrictionConfig

  // Windrichtung
  /** AUTO = alle 4 Hauptrichtungen, MANUAL = nur manualWindDirections. Default: AUTO */
  windMode?: 'AUTO' | 'MANUAL'
  /**
   * Kompasswinkel in Grad (nur bei windMode === 'MANUAL').
   * 0° = Nord/+Y, 90° = Ost/+X, 180° = Süd/-Y, 270° = West/-X
   * Beispiel: [0, 90] = Wind von Nord und Ost
   */
  manualWindDirections?: number[]
}

// ─────────────────────────────────────────────
// BERECHNUNGSERGEBNISSE
// ─────────────────────────────────────────────

export interface WindLoadResult {
  peakVelocityPressure: number   // qp(z) in kN/m²
  referenceHeight: number        // z in m
  windForceX: number             // Fw in kN, Richtung +X
  windForceY: number             // Fw in kN, Richtung +Y
}

export interface BeamResult {
  beamId: string
  maxBendingMomentKNm: number
  maxShearForceKN: number
  bendingUtilization: number     // η = MEd / MRd, ≤ 1.0 = OK
  shearUtilization: number       // η = VEd / VRd, ≤ 1.0 = OK
  maxDeflectionMm: number
  isOk: boolean
  failureReason?: string
}

export interface SupportResult {
  supportId: string
  /** Vertikale Auflagerkraft unter Bemessungslasten */
  verticalReactionKN: number
  horizontalReactionXKN: number
  horizontalReactionYKN: number
  bucklingUtilization: number    // η Knicken, ≤ 1.0 = OK
  isOk: boolean
  failureReason?: string
}

export interface TippingDirectionResult {
  /** Kleinste (negativste) vertikale Auflagerkraft = abhebend */
  minVerticalReactionKN: number
  /** IDs der Stützen die die Kippachse bilden */
  tippingAxisSupportIds: [string, string]
  /** IDs der Stützen, auf denen Zusatzballast stabilisierend angesetzt wird */
  ballastSupportIds: string[]
  /** Erforderlicher Ballast pro stabilisierender Ballaststütze */
  requiredBallastPerSupportKg: number
  /** Gesamterforderlicher Ballast für diesen Lastfall */
  requiredBallastTotalKg: number
  utilization: number            // η = M_kippend / M_stabilisierend, ≤ 1.0 = OK
  isOk: boolean
}

export interface TippingResult {
  /**
   * Alle berechneten Richtungen.
   * AUTO: 4 Richtungen (0°/N, 90°/O, 180°/S, 270°/W).
   * MANUAL: nur die in manualWindDirections angegebenen Winkel.
   * angleDeg ist der Kompasswinkel (0° = Nord).
   */
  directions: { angleDeg: number; result: TippingDirectionResult }[]
  /** Maßgebender Lastfall (höchster Ballastbedarf) */
  governing: TippingDirectionResult
  /** Kompasswinkel des maßgebenden Lastfalls in Grad */
  governingAngleDeg: number
}

export interface SlidingResult {
  resultingHorizontalForceKN: number
  requiredBallastKg: number      // negativ = kein Ballast erforderlich
  isOk: boolean
  frictionCoefficientUsed: number
}

export interface CalculationResult {
  // Eingabe (für Report)
  input: StructureInput

  // Normangaben die verwendet wurden
  normReferences: string[]

  // Teilberechnungen
  windLoad: WindLoadResult
  beams: BeamResult[]
  supports: SupportResult[]
  tipping: TippingResult
  sliding: SlidingResult

  // Zusammenfassung
  overallOk: boolean

  /** Gesamterforderlicher Ballast (max aus Kippen und Gleiten) in kg */
  requiredBallastTotalKg: number

  /** Aufschlüsselung pro Stütze (für Report-Tabelle) */
  ballastPerSupport: {
    supportId: string
    supportLabel: string
    requiredBallastKg: number
    existingBallastKg: number
    additionalBallastNeededKg: number
  }[]

  /** Zeitstempel der Berechnung */
  calculatedAt: string  // ISO 8601

  /** Warnungen (nicht kritisch, aber hinweispflichtig) */
  warnings: string[]

  /** Fehler (führen zu isOk = false) */
  errors: string[]
}

// ─────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────

export interface ReportConfig {
  companyName: string          // "Cologne Hunters Licht & Ton Service GmbH"
  companyAddress: string
  logoBase64?: string          // optional für PDF-Header
  disclaimer: string           // Rechtlicher Hinweis
  signatureName: string        // Name der verantwortlichen Person
}

export interface ReportData {
  result: CalculationResult
  config: ReportConfig
}

// ─────────────────────────────────────────────
// VW JSON IMPORT FORMAT
// ─────────────────────────────────────────────

/**
 * Format das das Vectorworks Python-Script exportiert.
 * Wird in web-app/import/ in ein StructureInput umgewandelt.
 */
export interface VWExportData {
  exportVersion: '1.0'
  supports: {
    id: string
    label: string
    x: number          // mm in VW → wird zu m konvertiert
    y: number          // mm in VW → wird zu m konvertiert
    height: number     // mm
    trussType: string  // muss auf TrussType gemappt werden
    footType: string
  }[]
  beams: {
    id: string
    label: string
    startId: string
    endId: string
    trussType: string
    cantileverStart: number  // mm
    cantileverEnd: number    // mm
    loads: {
      label: string
      positionMm: number
      weightKg: number
    }[]
  }[]
}
