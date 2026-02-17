export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ConfigurationError extends AppError {}

export class ExternalServiceError extends AppError {
  constructor(
    message: string,
    public readonly service: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export class RateLimitError extends ExternalServiceError {
  constructor(
    service: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(`${service} rate limit exceeded`, service, 429);
  }
}

export class LlmResponseValidationError extends AppError {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly details?: string,
  ) {
    super(message);
  }
}

export class LlmUnavailableError extends AppError {
  constructor() {
    super("LLM_UNAVAILABLE");
  }
}
