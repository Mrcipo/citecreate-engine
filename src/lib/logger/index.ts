import pino from "pino";

// TODO: Extend logger options (redaction, serializers, level strategy).
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
