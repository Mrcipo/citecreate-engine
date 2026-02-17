import { ConfigurationError, ExternalServiceError, RateLimitError } from "../errors";

export interface UnpaywallRecord {
  isOpenAccess: boolean;
  oaUrl: string | null;
}

export interface UnpaywallClient {
  findByDoi(doi: string): Promise<UnpaywallRecord>;
}

type FetchLike = typeof fetch;

const UNPAYWALL_API_BASE_URL = "https://api.unpaywall.org/v2";

export function createUnpaywallClient(fetchImpl: FetchLike = fetch): UnpaywallClient {
  return {
    async findByDoi(doi: string): Promise<UnpaywallRecord> {
      const email = process.env.UNPAYWALL_EMAIL?.trim();
      if (!email) {
        throw new ConfigurationError("UNPAYWALL_EMAIL is required for Unpaywall requests");
      }

      const encodedDoi = encodeURIComponent(doi.trim());
      const response = await fetchImpl(`${UNPAYWALL_API_BASE_URL}/${encodedDoi}?email=${encodeURIComponent(email)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (response.status === 429) {
        throw new RateLimitError("unpaywall", parseRetryAfter(response));
      }

      if (!response.ok) {
        throw new ExternalServiceError(
          `Unpaywall request failed with status ${response.status}`,
          "unpaywall",
          response.status,
        );
      }

      const data = (await response.json()) as UnpaywallResponse;
      return {
        isOpenAccess: Boolean(data.is_oa),
        oaUrl: normalizeOaUrl(data.best_oa_location),
      };
    },
  };
}

function normalizeOaUrl(bestLocation: unknown): string | null {
  if (!bestLocation || typeof bestLocation !== "object") {
    return null;
  }

  const location = bestLocation as { url?: unknown; url_for_pdf?: unknown };
  if (typeof location.url_for_pdf === "string" && location.url_for_pdf.length > 0) {
    return location.url_for_pdf;
  }

  if (typeof location.url === "string" && location.url.length > 0) {
    return location.url;
  }

  return null;
}

function parseRetryAfter(response: Response): number | undefined {
  const raw = response.headers.get("retry-after");
  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

interface UnpaywallResponse {
  is_oa?: boolean;
  best_oa_location?: unknown;
}
