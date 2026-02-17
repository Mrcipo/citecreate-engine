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

interface GroqProviderOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const postVariantsSchema = z.array(postSchema).min(1);
const wrappedPostVariantsSchema = z.object({ posts: postVariantsSchema }).strict();

export function createGroqProvider(options: GroqProviderOptions = {}): LlmProvider {
  const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;
  const model = options.model ?? DEFAULT_GROQ_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;

  return {
    id: "groq",
    async extractClaims(input: ExtractClaimsInput): Promise<Extraction> {
      if (!apiKey) {
        throw new ConfigurationError("GROQ_API_KEY is required for GroqProvider");
      }

      const prompt = buildExtractionPrompt(input);
      const raw = await callGroq(prompt, apiKey, model, timeoutMs);
      return parseWithSingleRepair<Extraction>(
        "groq",
        raw,
        (value) => extractionSchema.parse(value),
        (details) => buildRepairPrompt(raw, details),
        (repairPrompt) => callGroq(repairPrompt, apiKey, model, timeoutMs),
      );
    },
    async generatePosts(input: GeneratePostsInput): Promise<PostVariant[]> {
      if (!apiKey) {
        throw new ConfigurationError("GROQ_API_KEY is required for GroqProvider");
      }

      const prompt = buildPostGenerationPrompt(input);
      const raw = await callGroq(prompt, apiKey, model, timeoutMs);
      return parseWithSingleRepair<PostVariant[]>(
        "groq",
        raw,
        (value) => {
          const arrayResult = postVariantsSchema.safeParse(value);
          if (arrayResult.success) {
            return arrayResult.data;
          }

          return wrappedPostVariantsSchema.parse(value).posts;
        },
        (details) => buildRepairPrompt(raw, details),
        (repairPrompt) => callGroq(repairPrompt, apiKey, model, timeoutMs),
      );
    },
  };
}

export const groqProvider: LlmProvider = createGroqProvider();

async function callGroq(
  prompt: string,
  apiKey: string,
  model: string,
  timeoutMs: number,
): Promise<string> {
  // TODO: Confirm final Groq model choice and response format defaults for production.
  const response = await fetchWithTimeout(
    GROQ_CHAT_COMPLETIONS_URL,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    timeoutMs,
  );

  if (response.status === 429) {
    throw new RateLimitError("groq");
  }

  if (!response.ok) {
    throw new ExternalServiceError(
      `Groq request failed with status ${response.status}`,
      "groq",
      response.status,
    );
  }

  const payload = (await response.json()) as GroqResponse;
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new ExternalServiceError("Groq response did not include text output", "groq", response.status);
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

interface GroqResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}
