# vw-export/TrussCalc_Record.py
# Vectorworks Python Script – TrussCalc Datensatz anlegen
#
# Legt den TrussCalc-Record mit allen benötigten Feldern in der aktuellen
# VW-Datei an. Einmalig pro VW-Datei ausführen, bevor Objekte damit
# versehen werden.
#
# Ausführen: Vectorworks → Extras → Skripte → Dieses Script

import vs

RECORD_NAME = "TrussCalc"

# Felddefinitionen: (Name, Typ, Standardwert)
# vs.kFieldText    = Textfeld
# vs.kFieldNumber  = Zahlenfeld
FIELDS = [
    ("Type",                  vs.kFieldText,   "PROLYTE_H40V"),  # TrussType-String
    ("Height",                vs.kFieldNumber, 4000),             # Stützenhöhe in mm
    ("MountHeight",           vs.kFieldNumber, 0),                # Montagehöhe horizontaler Traversen in mm
    ("FootType",              vs.kFieldText,   "BASEPLATE"),      # FootType-String
    ("Label",                 vs.kFieldText,   ""),               # Freitext-Bezeichnung
    ("Weight",                vs.kFieldNumber, 0),                # Gewicht einer Last in kg
    ("NumberOfConcreteBlocks", vs.kFieldNumber, 0),               # Anzahl Betonblöcke pro Stütze
]

# Zulässige Werte (als Hilfe für Anwender – Vectorworks zeigt diese nicht automatisch)
VALID_TRUSS_TYPES = [
    "PROLYTE_H40V",
    "PROLYTE_H30V",
    "PROLYTE_H30D",
    "PROLYTE_S40T",
    "PROLYTE_S52F",
    "EUROTRUSS_TD44",
    "EUROTRUSS_ST50",
    "PIPE_48_3_STEEL",
    "PIPE_50_3_ALU",
]

VALID_FOOT_TYPES = [
    "BASEPLATE",
    "CONCRETE_BLOCK_1250",
    "TRUSS_PLATE_30x30",
]


def create_record():
    existing = vs.GetObject(RECORD_NAME)

    if existing and vs.GetType(existing) == 47:  # Typ 47 = Record Definition
        # Record existiert bereits – Felder prüfen und fehlende ergänzen
        added = []
        for fname, ftype, fdefault in FIELDS:
            # Prüfen ob Feld bereits vorhanden
            field_exists = False
            num_fields = vs.NumFields(existing)
            for i in range(1, num_fields + 1):
                if vs.GetFldName(existing, i) == fname:
                    field_exists = True
                    break
            if not field_exists:
                vs.AddField(RECORD_NAME, fname, fdefault, ftype)
                added.append(fname)

        if added:
            msg = (
                f"TrussCalc Record bereits vorhanden.\n\n"
                f"Folgende Felder wurden ergänzt:\n" +
                "\n".join(f"  • {f}" for f in added)
            )
        else:
            msg = (
                "TrussCalc Record ist bereits vollständig vorhanden.\n\n"
                "Keine Änderungen vorgenommen."
            )
        vs.AlrtDialog(msg)
        return

    # Record neu anlegen
    # vs.NewSymbol legt keine Record-Definition an – korrekte API: vs.BeginDef / NewRecord
    # In VW-Python wird ein Record über NewRecord angelegt:
    vs.NewRecord(RECORD_NAME)

    for fname, ftype, fdefault in FIELDS:
        vs.AddField(RECORD_NAME, fname, fdefault, ftype)

    # Bestätigung mit Hinweisen zur Verwendung
    info_lines = [
        "TrussCalc Record erfolgreich angelegt!",
        "",
        "Felder:",
        "  Type                  – TrussType (z.B. PROLYTE_H40V)",
        "  Height                – Höhe/Länge in mm",
        "  MountHeight           – Montagehöhe horizontaler Traversen in mm (0 = automatisch)",
        "  FootType              – Fußtyp (z.B. BASEPLATE)",
        "  Label                 – Bezeichnung (Freitext)",
        "  Weight                – Gewicht einer Last in kg",
        "  NumberOfConcreteBlocks – Anzahl Betonblöcke pro Stütze (optional)",
        "",
        "Zulässige Type-Werte:",
    ]
    for t in VALID_TRUSS_TYPES:
        info_lines.append(f"  {t}")
    info_lines += [
        "",
        "Zulässige FootType-Werte:",
    ]
    for f in VALID_FOOT_TYPES:
        info_lines.append(f"  {f}")
    info_lines += [
        "",
        "Nächste Schritte:",
        "1. Objekte markieren",
        "2. Datensatz 'TrussCalc' über das Daten-Fenster zuweisen",
        "3. Felder ausfüllen",
        "4. export_truss.py ausführen",
    ]

    vs.AlrtDialog("\n".join(info_lines))


create_record()
