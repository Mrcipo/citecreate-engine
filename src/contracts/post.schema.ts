import { z } from "zod";

export const postPlatformSchema = z.enum(["linkedin", "x", "threads", "bluesky"]);

export const postSchema = z
  .object({
    platform: postPlatformSchema,
    contentText: z.string().min(1),
    hashtags: z.array(z.string().regex(/^#[^\s#]+$/, "Hashtag must start with #")).optional(),
    citationBlock: z.string().min(1),
  })
  .strict();

export type PostPlatform = z.infer<typeof postPlatformSchema>;
export type Post = z.infer<typeof postSchema>;
