import { describe, expect, it } from "vitest";

import { extractionSchema } from "./extraction.schema";

describe("extractionSchema", () => {
  it("accepts a valid extraction payload", () => {
    const result = extractionSchema.safeParse({
      claims: ["Claim 1", "Claim 2", "Claim 3"],
      population: "Adults with hypertension",
      intervention: "Low-sodium diet",
      outcomes: "Reduced blood pressure",
      limitations: "Small sample size",
      evidenceLevel: "moderate",
      confidenceScore: 0.82,
      citations: [
        {
          title: "Sample Trial",
          doi: "10.1000/xyz123",
          url: "https://example.org/paper",
          year: 2020,
          sourceUsed: true,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid claims length and confidence score", () => {
    const result = extractionSchema.safeParse({
      claims: ["Only one claim"],
      population: "Adults",
      intervention: "Exercise",
      outcomes: "Weight loss",
      limitations: "Short follow-up",
      evidenceLevel: "low",
      confidenceScore: 1.2,
      citations: [
        {
          title: "Sample",
          sourceUsed: true,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown keys due to strict schema", () => {
    const result = extractionSchema.safeParse({
      claims: ["Claim 1", "Claim 2", "Claim 3"],
      population: "Adults",
      intervention: "Exercise",
      outcomes: "Weight loss",
      limitations: "Short follow-up",
      evidenceLevel: "low",
      confidenceScore: 0.4,
      citations: [
        {
          title: "Sample",
          sourceUsed: true,
        },
      ],
      extraField: "not-allowed",
    });

    expect(result.success).toBe(false);
  });
});
