# vw-export/export_truss.py
# Vectorworks Python Script – Truss Calculator Export
# Ausführen: Vectorworks → Extras → Skripte → Dieses Script
#
# Exportiert alle Traversenobjekte der aktuellen Zeichnung als JSON
# im Format VWExportData (packages/calc-engine/src/types.ts).

import vs
import json
import os
import math


# ─────────────────────────────────────────────
# KONSTANTEN
# ─────────────────────────────────────────────

RECORD_NAME = "TrussCalc"

# Symbolnamen-Schlüsselwörter für Stützen-Erkennung (Option A)
SUPPORT_KEYWORDS = ("tower", "stütze", "stutze", "support", "h30", "h40", "s40", "s52")

# Symbolnamen-Schlüsselwörter für Traversen-Erkennung (Option A)
BEAM_KEYWORDS = ("traverse", "truss", "beam", "h30", "h40", "s40", "s52", "pipe")

# Maximale Distanz Endpunkt–Stütze um Zuordnung zu akzeptieren [mm]
SNAP_TOLERANCE_MM = 200.0


# ─────────────────────────────────────────────
# HILFSFUNKTIONEN
# ─────────────────────────────────────────────

def get_record_field(obj_handle, record_name, field_name):
    """Liest ein Record-Feld sicher aus. Gibt None zurück wenn Record/Feld fehlt."""
    try:
        if not vs.IsRecordAttached(record_name, obj_handle):
            return None
        value = vs.GetRField(obj_handle, record_name, field_name)
        # GetRField gibt leeren String zurück wenn Feld nicht existiert
        if value == '' or value is None:
            return None
        return value
    except Exception:
        return None


def get_object_name(obj_handle):
    """Gibt den Symbolnamen oder Objektnamen zurück."""
    # Bei Symbol-Instanzen: Name des Symbols
    sym_name = vs.GetSymName(obj_handle)
    if sym_name:
        return sym_name
    return vs.GetName(obj_handle) or ''


def get_bounding_box_center(obj_handle):
    """Gibt Mittelpunkt der Bounding Box als (x, y) in mm zurück."""
    (x1, y1), (x2, y2) = vs.GetBBox(obj_handle)
    return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


def get_object_height_mm(obj_handle):
    """
    Liest Höhe aus TrussCalc.Height oder aus Z-Ausdehnung des 3D-Objekts.
    Gibt Höhe in mm zurück, Fallback 4000mm.
    """
    val = get_record_field(obj_handle, RECORD_NAME, "Height")
    if val is not None:
        try:
            return float(val)
        except (ValueError, TypeError):
            pass
    # 3D-Bounding-Box Z-Ausdehnung
    try:
        (_, _, z1), (_, _, z2) = vs.Get3DBBox(obj_handle)
        height = abs(z2 - z1)
        if height > 10:  # plausibel (> 1cm)
            return height
    except Exception:
        pass
    return 4000.0  # Fallback


def get_beam_mount_height_mm(obj_handle):
    """
    Liest optionale Montagehöhe einer horizontalen Traverse in mm.
    Priorität: TrussCalc.MountHeight, danach Unterkante der 3D-Bounding-Box.
    Gibt None zurück, wenn keine sinnvolle Höhe gefunden wurde.
    """
    val = get_record_field(obj_handle, RECORD_NAME, "MountHeight")
    if val is not None:
        try:
            mount_height = float(val)
            if mount_height > 0:
                return mount_height
        except (ValueError, TypeError):
            pass

    try:
        (_, _, z1), (_, _, z2) = vs.Get3DBBox(obj_handle)
        mount_height = min(z1, z2)
        if abs(mount_height) > 10:
            return mount_height
    except Exception:
        pass

    return None


def classify_truss_type(symbol_name: str, record_value: str) -> str:
    """Mappt Symbolname oder Record-Wert auf TrussType-String."""
    mapping = [
        ('h40v',  'PROLYTE_H40V'),
        ('h40',   'PROLYTE_H40V'),
        ('h30v',  'PROLYTE_H30V'),
        ('h30d',  'PROLYTE_H30D'),
        ('h30',   'PROLYTE_H30V'),
        ('s40t',  'PROLYTE_S40T'),
        ('s40',   'PROLYTE_S40T'),
        ('s52f',  'PROLYTE_S52F'),
        ('s52',   'PROLYTE_S52F'),
        ('td44',  'EUROTRUSS_TD44'),
        ('st50',  'EUROTRUSS_ST50'),
        ('pipe',  'PIPE_48_3_STEEL'),
        ('rohr',  'PIPE_48_3_STEEL'),
        ('48.3',  'PIPE_48_3_STEEL'),
        ('50alu', 'PIPE_50_3_ALU'),
    ]
    name_lower = (record_value or symbol_name or '').lower()
    for key, value in mapping:
        if key in name_lower:
            return value
    return 'PROLYTE_H40V'  # Fallback


def classify_foot_type(record_value: str) -> str:
    """Mappt Record-Wert auf FootType-String."""
    if not record_value:
        return 'BASEPLATE'
    val = record_value.strip().upper()
    if 'CONCRETE' in val or '1250' in val or 'BETON' in val:
        return 'CONCRETE_BLOCK_1250'
    if 'PLATE_30' in val or '30X30' in val or '30×30' in val or 'TRUSS_PLATE' in val:
        return 'TRUSS_PLATE_30x30'
    return 'BASEPLATE'


def distance_2d(x1, y1, x2, y2) -> float:
    """Euklidische Distanz in XY-Ebene."""
    return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)


def find_nearest_support(point_x, point_y, supports, tolerance_mm=SNAP_TOLERANCE_MM):
    """
    Gibt ID der nächsten Stütze zurück wenn innerhalb tolerance_mm,
    sonst None.
    """
    best_id = None
    best_dist = float('inf')
    for s in supports:
        d = distance_2d(point_x, point_y, s['x'], s['y'])
        if d < best_dist:
            best_dist = d
            best_id = s['id']
    if best_dist <= tolerance_mm:
        return best_id
    return None


def is_support_object(obj_handle) -> bool:
    """Erkennt ob ein Objekt eine Stütze ist (Option B bevorzugt, Fallback A)."""
    # Option B: TrussCalc-Record mit Type-Feld vorhanden
    record_type = get_record_field(obj_handle, RECORD_NAME, "Type")
    if record_type:
        # Hat einen Record – wird als Stütze oder Traverse eingestuft anhand des Typs
        # Stützen haben keine Beam-Keywords im Label
        label = get_record_field(obj_handle, RECORD_NAME, "Label") or ''
        sym_name = get_object_name(obj_handle).lower()
        # Wenn Record vorhanden und Symbolname auf Stütze hindeutet
        for kw in SUPPORT_KEYWORDS:
            if kw in sym_name or kw in label.lower():
                return True
        # Record vorhanden aber keine Unterscheidung möglich → Stütze wenn Höhe gesetzt
        height_val = get_record_field(obj_handle, RECORD_NAME, "Height")
        if height_val:
            return True
        return False

    # Option A: Symbolname-Matching
    sym_name = get_object_name(obj_handle).lower()
    for kw in SUPPORT_KEYWORDS:
        if kw in sym_name:
            return True
    return False


def is_beam_object(obj_handle) -> bool:
    """Erkennt ob ein Objekt eine horizontale Traverse ist."""
    record_type = get_record_field(obj_handle, RECORD_NAME, "Type")
    sym_name = get_object_name(obj_handle).lower()

    # Objekte mit Record aber ohne Stützen-Keyword → Traverse
    if record_type:
        for kw in BEAM_KEYWORDS:
            if kw in sym_name:
                return True

    # Option A: Symbolname
    for kw in BEAM_KEYWORDS:
        if kw in sym_name:
            # Nicht als Traverse einordnen wenn es eindeutig eine Stütze ist
            if any(sk in sym_name for sk in ("tower", "stütze", "stutze", "support")):
                return False
            return True
    return False


def get_beam_endpoints(obj_handle):
    """
    Gibt Start- und Endpunkt einer Traverse zurück (x1,y1), (x2,y2) in mm.
    Für Linien: direkt. Für Flächen/Symbols: Bounding-Box-Ecken.
    """
    obj_type = vs.GetType(obj_handle)

    # Typ 2 = Linie
    if obj_type == 2:
        (x1, y1) = vs.GetSegPt1(obj_handle)
        (x2, y2) = vs.GetSegPt2(obj_handle)
        return (x1, y1), (x2, y2)

    # Typ 11 = Polylinie, Typ 21 = Polyline
    if obj_type in (11, 21):
        # Erster und letzter Vertex
        n = vs.GetNumPts(obj_handle)
        if n >= 2:
            x1, y1 = vs.GetPt(obj_handle, 1)
            x2, y2 = vs.GetPt(obj_handle, n)
            return (x1, y1), (x2, y2)

    # Fallback: Bounding-Box-Kanten (längere Seite = Traverse-Richtung)
    (bx1, by1), (bx2, by2) = vs.GetBBox(obj_handle)
    width = abs(bx2 - bx1)
    height = abs(by2 - by1)
    if width >= height:
        # Horizontal ausgerichtet
        cx = (bx1 + bx2) / 2.0
        cy = (by1 + by2) / 2.0
        return (bx1, cy), (bx2, cy)
    else:
        # Vertikal ausgerichtet
        cx = (bx1 + bx2) / 2.0
        cy = (by1 + by2) / 2.0
        return (cx, by1), (cx, by2)


def collect_loads_for_beam(beam_handle, beam_start, beam_end):
    """
    Sucht Objekte die an der Traverse hängen (innerhalb Bounding Box).
    Gibt Liste von Load-Dicts zurück.
    """
    loads = []
    (bx1, by1), (bx2, by2) = vs.GetBBox(beam_handle)
    beam_length = distance_2d(beam_start[0], beam_start[1], beam_end[0], beam_end[1])

    def callback(obj_handle):
        """Wird für jedes Objekt in der Zeichnung aufgerufen."""
        if obj_handle == beam_handle:
            return True

        cx, cy = get_bounding_box_center(obj_handle)
        # XY innerhalb der Beam-Bounding-Box (mit 50mm Toleranz)
        margin = 50.0
        if not (bx1 - margin <= cx <= bx2 + margin and
                by1 - margin <= cy <= by2 + margin):
            return True

        # Gewicht aus Record
        weight_val = get_record_field(obj_handle, RECORD_NAME, "Weight")
        label_val = get_record_field(obj_handle, RECORD_NAME, "Label")

        weight_kg = 0.0
        if weight_val:
            try:
                weight_kg = float(weight_val)
            except (ValueError, TypeError):
                weight_kg = 0.0

        label = label_val or get_object_name(obj_handle) or "Unbekannt"

        # Position entlang Traverse (Projektion auf Traverse-Vektor)
        if beam_length > 0:
            dx = beam_end[0] - beam_start[0]
            dy = beam_end[1] - beam_start[1]
            # Skalierter Projektionsabstand vom Startpunkt
            t = ((cx - beam_start[0]) * dx + (cy - beam_start[1]) * dy) / (beam_length ** 2)
            t = max(0.0, min(1.0, t))
            pos_mm = t * beam_length
        else:
            pos_mm = 0.0

        loads.append({
            "label": label,
            "positionMm": round(pos_mm, 1),
            "weightKg": weight_kg,
        })
        return True

    vs.ForEachObject(callback, "(ALL)")
    return loads


# ─────────────────────────────────────────────
# HAUPTFUNKTIONEN
# ─────────────────────────────────────────────

def collect_supports() -> list:
    """Iteriert alle Objekte, sammelt Stützen."""
    supports = []
    counter = [0]  # Mutable für Closure
    warnings = []

    def callback(obj_handle):
        if not is_support_object(obj_handle):
            return True

        counter[0] += 1
        obj_id = f"S{counter[0]}"

        # Label
        label = get_record_field(obj_handle, RECORD_NAME, "Label")
        if not label:
            label = get_object_name(obj_handle) or f"Stütze {counter[0]}"

        # Position (Mittelpunkt Bounding Box)
        cx, cy = get_bounding_box_center(obj_handle)

        # Höhe
        height_mm = get_object_height_mm(obj_handle)

        # TrussType
        record_type = get_record_field(obj_handle, RECORD_NAME, "Type") or ''
        sym_name = get_object_name(obj_handle)
        truss_type = classify_truss_type(sym_name, record_type)
        if truss_type == 'PROLYTE_H40V' and not record_type and not any(
            k in sym_name.lower() for k in ('h40', 'tower', 'support')
        ):
            warnings.append(f"Stütze '{label}': TrussType nicht eindeutig, Fallback PROLYTE_H40V")

        # FootType
        foot_val = get_record_field(obj_handle, RECORD_NAME, "FootType") or ''
        foot_type = classify_foot_type(foot_val)

        # Anzahl Betonblöcke aus Record (optional)
        num_blocks_val = get_record_field(obj_handle, RECORD_NAME, "NumberOfConcreteBlocks")
        num_blocks = None
        if num_blocks_val:
            try:
                num_blocks = int(float(num_blocks_val))
            except (ValueError, TypeError):
                pass

        support_entry = {
            "id": obj_id,
            "label": label,
            "x": round(cx, 1),
            "y": round(cy, 1),
            "height": round(height_mm, 1),
            "trussType": truss_type,
            "footType": foot_type,
            "_warnings": warnings,  # wird vor Export entfernt
        }
        if num_blocks is not None:
            support_entry["numberOfConcreteBlocks"] = num_blocks
        supports.append(support_entry)
        return True

    vs.ForEachObject(callback, "(ALL)")

    # Interne _warnings-Felder entfernen
    all_warnings = []
    for s in supports:
        all_warnings.extend(s.pop("_warnings", []))

    return supports, all_warnings


def collect_beams(supports: list) -> list:
    """Iteriert alle Objekte, sammelt Traversen inkl. Lasten."""
    beams = []
    counter = [0]
    warnings = []

    def callback(obj_handle):
        if not is_beam_object(obj_handle):
            return True

        counter[0] += 1
        beam_id = f"B{counter[0]}"

        # Label
        label = get_record_field(obj_handle, RECORD_NAME, "Label")
        if not label:
            label = get_object_name(obj_handle) or f"Traverse {counter[0]}"

        # TrussType
        record_type = get_record_field(obj_handle, RECORD_NAME, "Type") or ''
        sym_name = get_object_name(obj_handle)
        truss_type = classify_truss_type(sym_name, record_type)

        # Endpunkte
        (x1, y1), (x2, y2) = get_beam_endpoints(obj_handle)

        # Nächste Stützen an den Endpunkten
        start_id = find_nearest_support(x1, y1, supports)
        end_id = find_nearest_support(x2, y2, supports)

        if start_id is None:
            warnings.append(f"Traverse '{label}': Startpunkt ohne zugeordnete Stütze → UNBEKANNT")
            start_id = "UNBEKANNT"
        if end_id is None:
            warnings.append(f"Traverse '{label}': Endpunkt ohne zugeordnete Stütze → UNBEKANNT")
            end_id = "UNBEKANNT"

        # Auskragung berechnen
        cantilever_start = 0.0
        cantilever_end = 0.0
        if start_id != "UNBEKANNT":
            start_support = next((s for s in supports if s['id'] == start_id), None)
            if start_support:
                cantilever_start = distance_2d(x1, y1, start_support['x'], start_support['y'])
        if end_id != "UNBEKANNT":
            end_support = next((s for s in supports if s['id'] == end_id), None)
            if end_support:
                cantilever_end = distance_2d(x2, y2, end_support['x'], end_support['y'])

        # Lasten (Einzellasten)
        beam_start = (x1, y1)
        beam_end = (x2, y2)
        loads = collect_loads_for_beam(obj_handle, beam_start, beam_end)
        mount_height = get_beam_mount_height_mm(obj_handle)

        # Zwischenstützen ermitteln: alle Stützen innerhalb der Bounding Box der Traverse
        (bx1, by1), (bx2, by2) = vs.GetBBox(obj_handle)
        margin = SNAP_TOLERANCE_MM
        intermediate_ids = []
        for s in supports:
            sid = s['id']
            if sid in (start_id, end_id):
                continue
            if (bx1 - margin <= s['x'] <= bx2 + margin and
                    by1 - margin <= s['y'] <= by2 + margin):
                intermediate_ids.append(sid)

        # Geordnete Liste Start → Zwischenstützen (nach Entfernung vom Start) → End
        def dist_from_start(sid):
            s = next((ss for ss in supports if ss['id'] == sid), None)
            if not s:
                return float('inf')
            return distance_2d(x1, y1, s['x'], s['y'])

        intermediate_ids.sort(key=dist_from_start)
        all_support_ids = (
            ([start_id] if start_id != "UNBEKANNT" else []) +
            intermediate_ids +
            ([end_id] if end_id != "UNBEKANNT" else [])
        )

        beam_data = {
            "id": beam_id,
            "label": label,
            "startId": start_id,
            "endId": end_id,
            "supportIds": all_support_ids,
            "trussType": truss_type,
            "cantileverStart": round(cantilever_start, 1),
            "cantileverEnd": round(cantilever_end, 1),
            "loads": loads,
            "distributedLoads": [],
        }
        if mount_height is not None:
            beam_data["mountHeight"] = round(mount_height, 1)

        beams.append(beam_data)
        return True

    vs.ForEachObject(callback, "(ALL)")
    return beams, warnings


# ─────────────────────────────────────────────
# EXPORT
# ─────────────────────────────────────────────

def export():
    supports, support_warnings = collect_supports()
    beams, beam_warnings = collect_beams(supports)
    all_warnings = support_warnings + beam_warnings

    if not supports and not beams:
        vs.AlrtDialog(
            "Keine Traversenobjekte gefunden.\n\n"
            "Prüfe Symbolnamen oder TrussCalc-Records.\n\n"
            "Erwartete Symbolnamen enthalten:\n"
            "  Stützen: tower, stütze, support, h30, h40, s40, s52\n"
            "  Traversen: traverse, truss, beam, h30, h40, s40, s52, pipe\n\n"
            "Alternativ: TrussCalc_Record.py ausführen und Record zuweisen."
        )
        return

    data = {
        "exportVersion": "1.0",
        "supports": supports,
        "beams": beams,
    }

    # Speicherpfad: gleicher Ordner wie die VW-Datei
    doc_path = vs.GetFPathName()
    if doc_path:
        export_dir = os.path.dirname(doc_path)
    else:
        export_dir = os.path.expanduser("~\\Desktop")

    file_path = os.path.join(export_dir, "truss_export.json")

    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except OSError as e:
        vs.AlrtDialog(f"Fehler beim Speichern:\n{e}")
        return

    # Zusammenfassung aufbauen
    summary_lines = [
        f"Export erfolgreich!",
        f"",
        f"Datei: {file_path}",
        f"",
        f"  {len(supports)} Stütze(n)",
        f"  {len(beams)} Traverse(n)",
    ]
    total_loads = sum(len(b['loads']) for b in beams)
    if total_loads:
        summary_lines.append(f"  {total_loads} Last(en)")

    if all_warnings:
        summary_lines.append("")
        summary_lines.append(f"Warnungen ({len(all_warnings)}):")
        for w in all_warnings[:5]:  # max. 5 anzeigen
            summary_lines.append(f"  • {w}")
        if len(all_warnings) > 5:
            summary_lines.append(f"  … und {len(all_warnings) - 5} weitere")

    vs.AlrtDialog("\n".join(summary_lines))


export()
