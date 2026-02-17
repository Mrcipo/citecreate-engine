import { ExternalServiceError, RateLimitError } from "../errors";

export interface CrossrefRecord {
  title: string;
  authors: string[];
  year: number | null;
  url: string | null;
  doi: string;
}

export interface CrossrefClient {
  findByDoi(doi: string): Promise<CrossrefRecord>;
}

type FetchLike = typeof fetch;

const CROSSREF_API_BASE_URL = "https://api.crossref.org/works";

export function createCrossrefClient(fetchImpl: FetchLike = fetch): CrossrefClient {
  return {
    async findByDoi(doi: string): Promise<CrossrefRecord> {
      const encodedDoi = encodeURIComponent(doi.trim());
      const response = await fetchImpl(`${CROSSREF_API_BASE_URL}/${encodedDoi}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (response.status === 429) {
        throw new RateLimitError("crossref", parseRetryAfter(response));
      }

      if (!response.ok) {
        throw new ExternalServiceError(
          `Crossref request failed with status ${response.status}`,
          "crossref",
          response.status,
        );
      }

      const data = (await response.json()) as CrossrefResponse;
      const message = data.message;
      const title = normalizeTitle(message.title);

      return {
        title,
        authors: normalizeAuthors(message.author),
        year: normalizeYear(message.issued?.["date-parts"]),
        url: message.URL ?? null,
        doi: message.DOI ?? doi,
      };
    },
  };
}

function normalizeTitle(value: unknown): string {
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].length > 0) {
    return value[0];
  }

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return "";
}

function normalizeAuthors(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((author) => {
      if (!author || typeof author !== "object") {
        return null;
      }

      const a = author as { given?: unknown; family?: unknown; name?: unknown };
      if (typeof a.name === "string" && a.name.length > 0) {
        return a.name;
      }

      const given = typeof a.given === "string" ? a.given : "";
      const family = typeof a.family === "string" ? a.family : "";
      const full = `${given} ${family}`.trim();
      return full.length > 0 ? full : null;
    })
    .filter((author): author is string => Boolean(author));
}

function normalizeYear(value: unknown): number | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const first = value[0];
  if (!Array.isArray(first)) {
    return null;
  }

  const year = first[0];
  return typeof year === "number" ? year : null;
}

function parseRetryAfter(response: Response): number | undefined {
  const raw = response.headers.get("retry-after");
  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

interface CrossrefResponse {
  message: {
    title?: unknown;
    author?: unknown;
    DOI?: string;
    URL?: string;
    issued?: {
      "date-parts"?: unknown;
    };
  };
}
