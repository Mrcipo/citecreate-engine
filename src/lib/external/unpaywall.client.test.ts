import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfigurationError, ExternalServiceError } from "../errors";
import { createUnpaywallClient } from "./unpaywall.client";

describe("createUnpaywallClient", () => {
  afterEach(() => {
    delete process.env.UNPAYWALL_EMAIL;
  });

  it("parses Unpaywall payload into normalized shape", async () => {
    process.env.UNPAYWALL_EMAIL = "test@example.com";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          is_oa: true,
          best_oa_location: {
            url: "https://example.org/article",
            url_for_pdf: "https://example.org/article.pdf",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = createUnpaywallClient(fetchMock);

    const result = await client.findByDoi("10.1000/xyz123");

    expect(result).toEqual({
      isOpenAccess: true,
      oaUrl: "https://example.org/article.pdf",
    });
  });

  it("throws ConfigurationError when UNPAYWALL_EMAIL is missing", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = createUnpaywallClient(fetchMock);

    await expect(client.findByDoi("10.1000/xyz123")).rejects.toBeInstanceOf(ConfigurationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws RateLimitError on HTTP 429", async () => {
    process.env.UNPAYWALL_EMAIL = "test@example.com";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("{}", { status: 429, headers: { "retry-after": "12" } }),
    );
    const client = createUnpaywallClient(fetchMock);

    await expect(client.findByDoi("10.1000/xyz123")).rejects.toMatchObject({
      name: "RateLimitError",
      service: "unpaywall",
      retryAfterSeconds: 12,
      status: 429,
    });
  });

  it("throws ExternalServiceError on non-OK responses", async () => {
    process.env.UNPAYWALL_EMAIL = "test@example.com";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 500 }));
    const client = createUnpaywallClient(fetchMock);

    await expect(client.findByDoi("10.1000/xyz123")).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
