export const TOOLTIP_TEXTS = {
  windZone:
    "DIN EN 1991-1-4/NA Tab. NA.B.3: Grundwindgeschwindigkeit vb je Windzone (22,5 bis 30,0 m/s).",
  terrainCategory:
    "DIN EN 1991-1-4 Tab. 4.1: Geländekategorie I (Küste) bis IV (Stadt). Beeinflusst z0, zmin und Turbulenz.",
  friction:
    "DIN EN 13814 Tab. 3: Reibwerte für Kontaktflächen-Paarungen. Niedrige µ-Werte erhöhen den Gleitballast.",
  baseplateOutrigger:
    "Wirksamer Hebelarm gegen Kippen: Bodenplattenkante oder Outrigger-Länge. Größerer Hebelarm reduziert den Zusatzballast.",
  dynamicFactor:
    "DGUV Information 215-313: +20 % Dynamikzuschlag auf alle veränderlichen Lasten bei Event-Strukturen.",
  gammaG:
    "DIN EN 1990 Tab. A.1.2: Teilsicherheitsbeiwert ständige Lasten (γG = 1,35 ungünstig, γG,inf = 0,90 günstig in EQU).",
  gammaQ:
    "DIN EN 1990 Tab. A.1.2: Teilsicherheitsbeiwert veränderliche Lasten (γQ = 1,50 ungünstig).",
  windMode:
    "DIN EN 1991-1-4 §4.2: Ungünstigste Richtung ist maßgebend. AUTO prüft alle 4 Hauptrichtungen, MANUAL nur ausgewählte.",
  indoorDoors:
    "DIN EN 17879: Bei Hallen mit öffnungsfähigen Toren kann eine horizontale Ersatzflächenlast maßgebend werden.",
  supportHeight:
    "DIN EN 17879 und EC-Nachweise: Stützenhöhe bestimmt Windangriffshöhe, Ersatzlasten und Knicklänge.",
  cantilever:
    "Kragarme erhöhen Biegemoment und Auflagerreaktionen. Die Engine prüft Auskragungen konservativ als Einfeldträger mit Kragarm.",
  distributedLoad:
    "DGUV Information 215-313: Streckenlasten werden als veränderliche Lasten mit γQ und 20 % Dynamikzuschlag angesetzt.",
  windSurface:
    "DIN EN 1991-1-4: Windflächen werden mit qp(z), Kraftbeiwert cf und richtungsabhängiger Projektionsfläche angesetzt.",
  snowLoad:
    "DIN EN 1991-1-3/NA: Schneelast s = μ · C_e · C_t · s_k. Relevanz bei Dächern, Planen oder horizontalen Flächen.",
} as const
