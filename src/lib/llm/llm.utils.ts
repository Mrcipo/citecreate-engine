import { LlmResponseValidationError } from "../errors";

export const DEFAULT_LLM_TIMEOUT_MS = 20_000;

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit,
  timeoutMs = DEFAULT_LLM_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  // Defensive parsing for providers that still wrap JSON in markdown fences.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  return trimmed;
}

export function parseJsonOrThrow(raw: string, provider: string): unknown {
  const jsonText = extractJsonText(raw);

  try {
    return JSON.parse(jsonText);
  } catch {
    throw new LlmResponseValidationError(
      `${provider} returned non-JSON output`,
      provider,
      jsonText.slice(0, 1000),
    );
  }
}
