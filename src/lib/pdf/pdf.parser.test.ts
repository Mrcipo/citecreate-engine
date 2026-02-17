import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { extractAbstract } from "./pdf.parser";

function fixture(name: string): string {
  const dirname = fileURLToPath(new URL(".", import.meta.url));
  return readFileSync(join(dirname, "__fixtures__", name), "utf8");
}

describe("extractAbstract", () => {
  it("extracts abstract between Abstract and Introduction", () => {
    const text = fixture("abstract.en.txt");
    const abstract = extractAbstract(text);

    expect(abstract).toContain("This study evaluates intervention X");
    expect(abstract).not.toContain("Introduction");
  });

  it("extracts abstract between Resumen and Introduccion", () => {
    const text = fixture("abstract.es.txt");
    const abstract = extractAbstract(text);

    expect(abstract).toContain("Este trabajo revisa evidencia clinica reciente");
    expect(abstract).not.toContain("Introduccion");
  });

  it("returns null if there is no abstract header", () => {
    expect(extractAbstract("Body text without the required header.\nIntroduction")).toBeNull();
  });

  it("applies max length limit when no introduction marker exists", () => {
    const longText = `Abstract\n${"a".repeat(4000)}`;
    const abstract = extractAbstract(longText, 500);

    expect(abstract).not.toBeNull();
    expect(abstract?.length).toBe(500);
  });
});
