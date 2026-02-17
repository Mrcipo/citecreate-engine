import { z } from "zod";

import { extractionSchema, type Extraction } from "../../contracts/extraction.schema";
import { postSchema } from "../../contracts/post.schema";
import {
  ConfigurationError,
  ExternalServiceError,
  LlmResponseValidationError,
  RateLimitError,
} from "../errors";
import type { LlmProvider } from "./llm.interface";
import { DEFAULT_LLM_TIMEOUT_MS, fetchWithTimeout, parseJsonOrThrow } from "./llm.utils";
import { buildExtractionPrompt, buildPostGenerationPrompt, buildRepairPrompt } from "./prompts";
import type { ExtractClaimsInput, GeneratePostsInput, PostVariant } from "./llm.types";

interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const postVariantsSchema = z.array(postSchema).min(1);
const wrappedPostVariantsSchema = z.object({ posts: postVariantsSchema }).strict();

export function createGeminiProvider(options: GeminiProviderOptions = {}): LlmProvider {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const model = options.model ?? DEFAULT_GEMINI_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;

  return {
    id: "gemini",
    async extractClaims(input: ExtractClaimsInput): Promise<Extraction> {
      if (!apiKey) {
        throw new ConfigurationError("GEMINI_API_KEY is required for GeminiProvider");
      }

      const prompt = buildExtractionPrompt(input);
      const raw = await callGemini(prompt, apiKey, model, timeoutMs);
      return parseWithSingleRepair<Extraction>(
        "gemini",
        raw,
        (value) => extractionSchema.parse(value),
        (details) => buildRepairPrompt(raw, details),
        (repairPrompt) => callGemini(repairPrompt, apiKey, model, timeoutMs),
      );
    },
    async generatePosts(input: GeneratePostsInput): Promise<PostVariant[]> {
      if (!apiKey) {
        throw new ConfigurationError("GEMINI_API_KEY is required for GeminiProvider");
      }

      const prompt = buildPostGenerationPrompt(input);
      const raw = await callGemini(prompt, apiKey, model, timeoutMs);
      return parseWithSingleRepair<PostVariant[]>(
        "gemini",
        raw,
        (value) => {
          const arrayResult = postVariantsSchema.safeParse(value);
          if (arrayResult.success) {
            return arrayResult.data;
          }

          return wrappedPostVariantsSchema.parse(value).posts;
        },
        (details) => buildRepairPrompt(raw, details),
        (repairPrompt) => callGemini(repairPrompt, apiKey, model, timeoutMs),
      );
    },
  };
}

export const geminiProvider: LlmProvider = createGeminiProvider();

async function callGemini(
  prompt: string,
  apiKey: string,
  model: string,
  timeoutMs: number,
): Promise<string> {
  // TODO: Confirm final endpoint/version and model mapping during integration hardening.
  const endpoint = `${GEMINI_BASE_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
    timeoutMs,
  );

  if (response.status === 429) {
    throw new RateLimitError("gemini");
  }

  if (!response.ok) {
    throw new ExternalServiceError(
      `Gemini request failed with status ${response.status}`,
      "gemini",
      response.status,
    );
  }

  const payload = (await response.json()) as GeminiResponse;
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) {
    throw new ExternalServiceError("Gemini response did not include text output", "gemini", response.status);
  }

  return text;
}

async function parseWithSingleRepair<T>(
  provider: string,
  rawOutput: string,
  validator: (value: unknown) => T,
  buildRepair: (details: string) => string,
  callRepair: (repairPrompt: string) => Promise<string>,
): Promise<T> {
  try {
    return validator(parseJsonOrThrow(rawOutput, provider));
  } catch (error) {
    const details = formatValidationError(error);
    const repairedRaw = await callRepair(buildRepair(details));

    try {
      return validator(parseJsonOrThrow(repairedRaw, provider));
    } catch (finalError) {
      throw new LlmResponseValidationError(
        `${provider} output is invalid after one repair attempt`,
        provider,
        formatValidationError(finalError),
      );
    }
  }
}

function formatValidationError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return JSON.stringify(error.issues);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown validation error";
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}
