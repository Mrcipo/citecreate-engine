import { describe, expect, it } from "vitest";

import { postSchema } from "./post.schema";

describe("postSchema", () => {
  it("accepts a valid post payload", () => {
    const result = postSchema.safeParse({
      platform: "linkedin",
      contentText: "Key findings from the paper...",
      hashtags: ["#science", "#evidence"],
      citationBlock: "Source: Example et al., 2024. https://example.org/paper",
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing citationBlock", () => {
    const result = postSchema.safeParse({
      platform: "x",
      contentText: "Summary content",
      hashtags: ["#research"],
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported platform", () => {
    const result = postSchema.safeParse({
      platform: "instagram",
      contentText: "Summary content",
      citationBlock: "Source block",
    });

    expect(result.success).toBe(false);
  });
});
