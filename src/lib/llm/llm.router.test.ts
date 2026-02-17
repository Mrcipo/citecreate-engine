import { describe, expect, it, vi } from "vitest";

import type { Extraction } from "../../contracts/extraction.schema";
import type { LlmProvider } from "./llm.interface";
import { createLlmRouter } from "./llm.router";

const extractionFixture: Extraction = {
  claims: ["c1", "c2", "c3"],
  population: "Adults",
  intervention: "Intervention",
  outcomes: "Outcomes",
  limitations: "Limitations",
  evidenceLevel: "moderate",
  confidenceScore: 0.7,
  citations: [{ title: "Paper", sourceUsed: true }],
};

function buildProvider(overrides: Partial<LlmProvider>): LlmProvider {
  return {
    id: "gemini",
    extractClaims: async () => extractionFixture,
    generatePosts: async () => [],
    ...overrides,
  };
}

describe("createLlmRouter", () => {
  it("retries primary on 429 and then falls back to groq", async () => {
    const primary = buildProvider({
      id: "gemini",
      extractClaims: vi
        .fn()
        .mockRejectedValueOnce({ status: 429 })
        .mockRejectedValueOnce({ status: 429 })
        .mockRejectedValueOnce({ status: 429 }),
    });
    const fallback = buildProvider({
      id: "groq",
      extractClaims: vi.fn().mockResolvedValue(extractionFixture),
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const router = createLlmRouter({ primary, fallback, sleep });

    const result = await router.extractClaims({ documentText: "doc" });

    expect(result).toEqual(extractionFixture);
    expect(primary.extractClaims).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 500);
    expect(sleep).toHaveBeenNthCalledWith(2, 1500);
    expect(fallback.extractClaims).toHaveBeenCalledTimes(1);
  });

  it("retries primary on 500 and then falls back", async () => {
    const primary = buildProvider({
      id: "gemini",
      generatePosts: vi
        .fn()
        .mockRejectedValueOnce({ status: 500 })
        .mockRejectedValueOnce({ status: 502 })
        .mockRejectedValueOnce({ status: 503 }),
    });
    const fallback = buildProvider({
      id: "groq",
      generatePosts: vi.fn().mockResolvedValue([
        {
          platform: "x",
          contentText: "content",
          citationBlock: "source",
        },
      ]),
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const router = createLlmRouter({ primary, fallback, sleep });

    const posts = await router.generatePosts({ extraction: extractionFixture });

    expect(posts).toHaveLength(1);
    expect(primary.generatePosts).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(fallback.generatePosts).toHaveBeenCalledTimes(1);
  });

  it("throws LLM_UNAVAILABLE when primary and fallback fail", async () => {
    const primary = buildProvider({
      id: "gemini",
      extractClaims: vi.fn().mockRejectedValue({ status: 500 }),
    });
    const fallback = buildProvider({
      id: "groq",
      extractClaims: vi.fn().mockRejectedValue(new Error("fallback down")),
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const router = createLlmRouter({ primary, fallback, sleep });

    await expect(router.extractClaims({ documentText: "doc" })).rejects.toThrow("LLM_UNAVAILABLE");
  });
});
