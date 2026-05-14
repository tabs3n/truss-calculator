import { describe, expect, it } from "vitest"

import { getWindZoneByPlz, getWindZoneNumberByPlz } from "../windzones-by-plz"

describe("PLZ → Windzone Lookup", () => {
  it("Köln (50677) → Windzone 2", () => {
    const result = getWindZoneByPlz("50677")
    expect(result).not.toBeNull()
    expect(result!.zone).toBe(2)
    expect(result!.exact).toBe(true)
  })

  it("München (80331) → Windzone 1", () => {
    const result = getWindZoneByPlz("80331")
    expect(result!.zone).toBe(1)
  })

  it("Hamburg (20095) → Windzone 3", () => {
    const result = getWindZoneByPlz("20095")
    expect(result!.zone).toBe(3)
  })

  it("Sylt (25996) → Windzone 4 (Küste)", () => {
    const result = getWindZoneByPlz("25996")
    expect(result!.zone).toBe(4)
  })

  it("Berlin (10115) → Windzone 2", () => {
    const result = getWindZoneByPlz("10115")
    expect(result!.zone).toBe(2)
  })

  it("Bodensee (88045) → Windzone 1", () => {
    const result = getWindZoneByPlz("88045")
    expect(result!.zone).toBe(1)
  })

  it("Numerische PLZ wird akzeptiert", () => {
    expect(getWindZoneNumberByPlz(50677)).toBe(2)
  })

  it("4-stellige PLZ wird auf 5 Stellen aufgefüllt", () => {
    // 1234 → 01234 → Präfix 01 → WZ2
    expect(getWindZoneNumberByPlz("1234")).toBe(2)
  })

  it("Ungültige PLZ → null", () => {
    expect(getWindZoneByPlz("abcde")).toBeNull()
    expect(getWindZoneByPlz("")).toBeNull()
    expect(getWindZoneByPlz("123")).toBeNull()
    expect(getWindZoneByPlz("123456")).toBeNull()
  })

  it("Note ist gesetzt wenn ein Hinweis hinterlegt ist", () => {
    const result = getWindZoneByPlz("80331")
    expect(result!.note).toBeDefined()
  })
})
