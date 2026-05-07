# Prompt – Vectorworks Python Export Script

## Ziel

Erstelle ein Vectorworks Python Script (`vw-export/export_truss.py`) das die aktuelle
Zeichnung analysiert und eine JSON-Datei im Format `VWExportData` exportiert.
Dieses Format ist in `packages/calc-engine/src/types.ts` definiert.

---

## Ausgabeformat

```json
{
  "exportVersion": "1.0",
  "supports": [
    {
      "id": "S1",
      "label": "Tower Links",
      "x": 0.0,
      "y": 0.0,
      "height": 4000.0,
      "trussType": "PROLYTE_H40V",
      "footType": "BASEPLATE"
    }
  ],
  "beams": [
    {
      "id": "B1",
      "label": "Traverse Vorne",
      "startId": "S1",
      "endId": "S2",
      "trussType": "PROLYTE_H40V",
      "cantileverStart": 0.0,
      "cantileverEnd": 500.0,
      "loads": [
        {
          "label": "Robe BMFL",
          "positionMm": 1500.0,
          "weightKg": 25.0
        }
      ]
    }
  ]
}
```

Alle Längenangaben in **Millimetern** (VW-intern). Die Web-App konvertiert auf Meter.

---

## Script-Anforderungen

### Stützen erkennen

Das Script liest alle Objekte in der Zeichnung die folgendes Kriterium erfüllen:

**Option A – Symbolname:**
Objekte deren Symbolname einen der folgenden Strings enthält (case-insensitive):
`"tower"`, `"stütze"`, `"support"`, `"h30"`, `"h40"`, `"s40"`, `"s52"`

**Option B – Record/Datensatz:**
Objekte mit einem angehängten Record namens `"TrussCalc"` mit folgenden Feldern:
- `TrussCalc.Type` → TrussType-String
- `TrussCalc.Height` → Höhe in mm
- `TrussCalc.FootType` → FootType-String
- `TrussCalc.Label` → Bezeichnung

Bevorzuge Option B wenn der Record vorhanden ist, fallback auf Option A.

**Position:** Mittelpunkt (Bounding Box Center) des Objekts in Weltkoordinaten → x, y in mm.

**Höhe:** aus Record `TrussCalc.Height` oder aus der Z-Ausdehnung des 3D-Objekts.

### Traversen erkennen

Objekte deren Symbolname einen der Strings enthält:
`"traverse"`, `"truss"`, `"beam"`, `"h30"`, `"h40"`, `"s40"`, `"s52"`, `"pipe"`

Oder mit Record `TrussCalc.Type`.

**Start/End-Stütze bestimmen:**
Finde die zwei Stützen die den Endpunkten der Traverse am nächsten liegen
(Distanz in XY-Ebene, Toleranz 200mm).

**Auskragung berechnen:**
Falls die Traverse über eine Stütze hinausragt:
`cantileverStart = Distanz(TraverseStartpunkt, StützeA_Position)`

### Lasten erkennen

Objekte die an einer Traverse hängen (Z-Position innerhalb der Traverse oder
direkt darunter, XY-Position innerhalb der Traverse-Bounding-Box):

Record `TrussCalc.Weight` → weightKg
Record `TrussCalc.Label` → label
Position entlang der Traverse → positionMm (Abstand vom Startpunkt)

Falls kein Record: Objekt-Name als Label, Gewicht = 0 (Benutzer trägt nach).

---

## Script-Struktur

```python
# vw-export/export_truss.py
# Vectorworks Python Script – Truss Calculator Export
# Ausführen: Vectorworks → Extras → Skripte → Dieses Script

import vs  # Vectorworks API
import json
import os

def get_record_field(obj_handle, record_name, field_name):
    """Liest ein Record-Feld sicher aus, gibt None zurück wenn nicht vorhanden."""

def classify_truss_type(symbol_name: str, record_value: str) -> str:
    """Mappt Symbolname oder Record-Wert auf TrussType-String."""
    mapping = {
        'h40v': 'PROLYTE_H40V',
        'h40':  'PROLYTE_H40V',
        'h30v': 'PROLYTE_H30V',
        'h30d': 'PROLYTE_H30D',
        'h30':  'PROLYTE_H30V',
        's40':  'PROLYTE_S40T',
        's52':  'PROLYTE_S52F',
        'pipe': 'PIPE_48_3_STEEL',
        'rohr': 'PIPE_48_3_STEEL',
    }
    name_lower = (record_value or symbol_name or '').lower()
    for key, value in mapping.items():
        if key in name_lower:
            return value
    return 'PROLYTE_H40V'  # Fallback

def classify_foot_type(record_value: str) -> str:
    """Mappt Record-Wert auf FootType-String."""

def find_nearest_support(point_x, point_y, supports, tolerance_mm=200):
    """Gibt die ID der nächsten Stütze zurück oder None."""

def collect_supports() -> list:
    """Iteriert alle Objekte, sammelt Stützen."""

def collect_beams(supports: list) -> list:
    """Iteriert alle Objekte, sammelt Traversen inkl. Lasten."""

def export():
    supports = collect_supports()
    beams = collect_beams(supports)

    data = {
        "exportVersion": "1.0",
        "supports": supports,
        "beams": beams
    }

    # Speicherpfad: gleicher Ordner wie die VW-Datei
    doc_path = vs.GetFPathName()
    if doc_path:
        export_dir = os.path.dirname(doc_path)
    else:
        export_dir = os.path.expanduser("~\\Desktop")

    file_path = os.path.join(export_dir, "truss_export.json")

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    vs.AlrtDialog(f"Export erfolgreich!\n{file_path}\n\n{len(supports)} Stützen, {len(beams)} Traversen")

export()
```

---

## Fehlerbehandlung

- Kein Objekt gefunden → Dialog: `"Keine Traversenobjekte gefunden. Prüfe Symbolnamen oder TrussCalc-Records."`
- Traverse ohne erkennbare Stützen → Traverse trotzdem exportieren, `startId` und `endId` = `"UNBEKANNT"`
- Unbekannter TrussType → Fallback `PROLYTE_H40V` + Warnung im Dialog

---

## Optionaler Schritt: TrussCalc Record-Definition

Erstelle zusätzlich `vw-export/TrussCalc_Record.py` – ein Script das den
`TrussCalc`-Datensatz in der aktuellen VW-Datei anlegt:

```python
# Legt den TrussCalc Record mit allen Feldern an
# Einmalig pro VW-Datei ausführen

import vs

fields = [
    ("Type",     vs.kFieldText,    "PROLYTE_H40V"),
    ("Height",   vs.kFieldNumber,  4000),
    ("FootType", vs.kFieldText,    "BASEPLATE"),
    ("Label",    vs.kFieldText,    ""),
    ("Weight",   vs.kFieldNumber,  0),
]

record_name = "TrussCalc"
if not vs.GetObject(record_name):
    vs.NewSymbol(record_name, 0, 0)  # Datensatz anlegen
    for fname, ftype, fdefault in fields:
        vs.AddField(record_name, fname, fdefault, ftype)
    vs.AlrtDialog("TrussCalc Record angelegt.")
else:
    vs.AlrtDialog("TrussCalc Record bereits vorhanden.")
```

---

## Verwendung

1. `TrussCalc_Record.py` einmalig in VW ausführen
2. Objekte in der Zeichnung mit dem Record versehen und Felder ausfüllen
3. `export_truss.py` ausführen → `truss_export.json` wird gespeichert
4. JSON in der Web-App über den Import-Button laden
