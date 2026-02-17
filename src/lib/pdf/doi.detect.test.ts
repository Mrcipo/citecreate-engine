import { describe, expect, it } from "vitest";

import { detectDoi, extractDois } from "./doi.detect";

describe("doi.detect", () => {
  it("extracts and deduplicates DOIs", () => {
    const text = `
      Primary DOI: 10.1000/XYZ123.
      URL form: https://doi.org/10.1000/xyz123
      Another: 10.5555/abc-789.
    `;

    expect(extractDois(text)).toEqual(["10.1000/xyz123", "10.5555/abc-789"]);
  });

  it("returns first DOI with detectDoi", () => {
    const text = "References include 10.1016/j.cell.2020.01.001 and 10.1000/xyz123.";
    expect(detectDoi(text)).toBe("10.1016/j.cell.2020.01.001");
  });

  it("returns null when no DOI exists", () => {
    expect(detectDoi("No doi present here")).toBeNull();
  });
});
