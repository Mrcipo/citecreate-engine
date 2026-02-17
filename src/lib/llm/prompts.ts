import type { ExtractClaimsInput, GeneratePostsInput } from "./llm.types";

const EXTRACTION_JSON_SHAPE = `{
  "claims": ["string", "string", "string"],
  "population": "string",
  "intervention": "string",
  "outcomes": "string",
  "limitations": "string",
  "evidenceLevel": "string",
  "confidenceScore": 0.0,
  "citations": [
    {
      "title": "string",
      "doi": "10.xxxx/...",
      "url": "https://...",
      "year": 2024,
      "sourceUsed": true
    }
  ]
}`;

const POSTS_JSON_SHAPE = `{
  "posts": [
    {
      "platform": "linkedin|x|threads|bluesky",
      "contentText": "string",
      "hashtags": ["#tag1", "#tag2"],
      "citationBlock": "string"
    }
  ]
}`;

export function buildExtractionPrompt(input: ExtractClaimsInput): string {
  return [
    "Extract structured scientific claims from the source text.",
    "Return ONLY strict JSON, no markdown, no commentary, no code fences.",
    "Follow this JSON shape exactly:",
    EXTRACTION_JSON_SHAPE,
    `DOI (if present): ${input.doi ?? "unknown"}`,
    `Abstract: ${input.abstractText ?? "not provided"}`,
    `Document text:\n${input.documentText}`,
  ].join("\n\n");
}

export function buildPostGenerationPrompt(input: GeneratePostsInput): string {
  const preferredPlatforms = input.preferredPlatforms?.join(", ") ?? "linkedin, x, threads, bluesky";
  const audience = input.audience ?? "general professional audience";

  return [
    "Generate social post variants from the extraction.",
    "Return ONLY strict JSON, no markdown, no commentary, no code fences.",
    "Use the exact shape below. The top-level key must be `posts`.",
    POSTS_JSON_SHAPE,
    `Audience: ${audience}`,
    `Preferred platforms: ${preferredPlatforms}`,
    `Extraction JSON:\n${JSON.stringify(input.extraction)}`,
  ].join("\n\n");
}

export function buildRepairPrompt(rawOutput: string, validationErrors: string): string {
  return [
    "Repair the JSON output so it becomes valid.",
    "Return ONLY repaired JSON, no markdown, no commentary, no code fences.",
    "Validation errors:",
    validationErrors,
    "Invalid JSON/output:",
    rawOutput,
  ].join("\n\n");
}
