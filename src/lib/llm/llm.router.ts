import { LlmUnavailableError } from "../errors";
import { geminiProvider } from "./gemini.provider";
import { groqProvider } from "./groq.provider";
import type { LlmProvider } from "./llm.interface";
import type { ExtractClaimsInput, GeneratePostsInput, LlmProviderId, PostVariant } from "./llm.types";
import type { Extraction } from "../../contracts/extraction.schema";

const PRIMARY_BACKOFF_MS = [500, 1500] as const;

export interface LlmRouterOptions {
  primary: LlmProvider;
  fallback: LlmProvider;
  sleep?: (ms: number) => Promise<void>;
}

export function createLlmRouter(options: LlmRouterOptions): LlmProvider {
  const sleep = options.sleep ?? defaultSleep;

  return {
    id: options.primary.id,
    async extractClaims(input: ExtractClaimsInput): Promise<Extraction> {
      return runWithFallback(
        () => options.primary.extractClaims(input),
        () => options.fallback.extractClaims(input),
        sleep,
      );
    },
    async generatePosts(input: GeneratePostsInput): Promise<PostVariant[]> {
      return runWithFallback(
        () => options.primary.generatePosts(input),
        () => options.fallback.generatePosts(input),
        sleep,
      );
    },
  };
}

export const llmProviders = {
  gemini: geminiProvider,
  groq: groqProvider,
} satisfies Record<LlmProviderId, LlmProvider>;

export function getLlmProvider(providerId: LlmProviderId): LlmProvider {
  return llmProviders[providerId];
}

export const llmRouter = createLlmRouter({
  primary: geminiProvider,
  fallback: groqProvider,
});

async function runWithFallback<T>(
  runPrimary: () => Promise<T>,
  runFallback: () => Promise<T>,
  sleep: (ms: number) => Promise<void>,
): Promise<T> {
  let primaryError: unknown;

  for (let attempt = 0; attempt <= PRIMARY_BACKOFF_MS.length; attempt += 1) {
    try {
      return await runPrimary();
    } catch (error) {
      primaryError = error;
      const canRetry = isRetriableError(error);
      const backoffMs = PRIMARY_BACKOFF_MS[attempt];
      if (!canRetry || backoffMs === undefined) {
        break;
      }

      await sleep(backoffMs);
    }
  }

  try {
    return await runFallback();
  } catch {
    throw new LlmUnavailableError();
  }
}

function isRetriableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const status = (error as { status?: number }).status;
  if (status === 429) {
    return true;
  }

  return typeof status === "number" && status >= 500 && status <= 599;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
