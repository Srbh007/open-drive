import { describe, it, expect } from "vitest";
import { getColumnLetter } from "./SheetViewer";

describe("SheetViewer getColumnLetter", () => {
  it("converts index to column letter", () => {
    expect(getColumnLetter(0)).toBe("A");
    expect(getColumnLetter(25)).toBe("Z");
    expect(getColumnLetter(26)).toBe("AA");
    expect(getColumnLetter(27)).toBe("AB");
    expect(getColumnLetter(51)).toBe("AZ");
    expect(getColumnLetter(52)).toBe("BA");
    expect(getColumnLetter(701)).toBe("ZZ");
    expect(getColumnLetter(702)).toBe("AAA");
  });
});
