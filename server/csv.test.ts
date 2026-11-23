import { describe, expect, it } from "vitest";
import { csvCell, isFormulaLike, toCsv } from "../shared/csv";

describe("CSV export hardening (item 7)", () => {
  it.each(["=1+1", "+44123", "-2+3", "@SUM(A1)", "  =cmd|' /C calc'!A0", "\t=1", "\r=1", "\u00a0=1", "\u200b+1", "\n@x"])(
    "prefixes %j with a quote",
    value => {
      expect(isFormulaLike(value)).toBe(true);
      expect(csvCell(value).startsWith(`"'`)).toBe(true);
    }
  );

  it("quotes the prefixed value after neutralising it", () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
  });

  it("leaves ordinary cells alone", () => {
    for (const value of ["reader@example.org", "en", "2026-01-02T00:00:00.000Z", "a=b", "x+y@z.org", ""]) {
      expect(isFormulaLike(value)).toBe(false);
    }
    expect(csvCell("reader@example.org")).toBe(`"reader@example.org"`);
    expect(csvCell(null)).toBe(`""`);
  });

  it("builds multi-row output", () => {
    expect(toCsv([["email", "status"], ["=x", "active"]])).toBe(`"email","status"\r\n"'=x","active"`);
  });
});
