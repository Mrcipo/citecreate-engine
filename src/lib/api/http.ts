import { ZodError } from "zod";

import {
  AppError,
  ConfigurationError,
  ExternalServiceError,
  LlmResponseValidationError,
  LlmUnavailableError,
  RateLimitError,
} from "../errors";

interface ErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface SuccessBody<T> {
  ok: true;
  data: T;
}

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ ok: true, data } satisfies SuccessBody<T>, init);
}

export function jsonError(code: string, message: string, status: number, details?: unknown): Response {
  return Response.json(
    {
      ok: false,
      error: { code, message, details },
    } satisfies ErrorBody,
    { status },
  );
}

export function handleRouteError(error: unknown): Response {
  if (error instanceof ZodError) {
    return jsonError("VALIDATION_ERROR", "Invalid request input", 400, error.issues);
  }

  if (error instanceof LlmUnavailableError) {
    return jsonError("LLM_UNAVAILABLE", error.message, 503);
  }

  if (error instanceof RateLimitError) {
    return jsonError("RATE_LIMITED", error.message, 429, {
      service: error.service,
      retryAfterSeconds: error.retryAfterSeconds,
    });
  }

  if (error instanceof LlmResponseValidationError) {
    return jsonError("LLM_INVALID_OUTPUT", error.message, 502, {
      provider: error.provider,
      details: error.details,
    });
  }

  if (error instanceof ExternalServiceError) {
    return jsonError("EXTERNAL_SERVICE_ERROR", error.message, 502, {
      service: error.service,
      upstreamStatus: error.status,
    });
  }

  if (error instanceof ConfigurationError) {
    return jsonError("CONFIGURATION_ERROR", error.message, 500);
  }

  if (error instanceof AppError) {
    return jsonError("APP_ERROR", error.message, 500);
  }

  if (error instanceof Error) {
    return jsonError("INTERNAL_ERROR", error.message, 500);
  }

  return jsonError("INTERNAL_ERROR", "Unknown error", 500);
}
