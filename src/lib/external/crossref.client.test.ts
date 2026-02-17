import { describe, expect, it, vi } from "vitest";

import { ExternalServiceError } from "../errors";
import { createCrossrefClient } from "./crossref.client";

describe("createCrossrefClient", () => {
  it("parses Crossref payload into normalized shape", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            title: ["Impact of intervention X"],
            author: [{ given: "Ada", family: "Lovelace" }, { name: "Anonymous Group" }],
            DOI: "10.1000/xyz123",
            URL: "https://doi.org/10.1000/xyz123",
            issued: { "date-parts": [[2022, 7, 2]] },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = createCrossrefClient(fetchMock);

    const result = await client.findByDoi("10.1000/xyz123");

    expect(result).toEqual({
      title: "Impact of intervention X",
      authors: ["Ada Lovelace", "Anonymous Group"],
      year: 2022,
      url: "https://doi.org/10.1000/xyz123",
      doi: "10.1000/xyz123",
    });
  });

  it("throws RateLimitError on HTTP 429", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("{}", { status: 429, headers: { "retry-after": "30" } }),
    );
    const client = createCrossrefClient(fetchMock);

    await expect(client.findByDoi("10.1000/xyz123")).rejects.toMatchObject({
      name: "RateLimitError",
      service: "crossref",
      retryAfterSeconds: 30,
      status: 429,
    });
  });

  it("throws ExternalServiceError on non-OK responses", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 500 }));
    const client = createCrossrefClient(fetchMock);

    await expect(client.findByDoi("10.1000/xyz123")).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
