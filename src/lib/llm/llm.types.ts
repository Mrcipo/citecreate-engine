export type LlmProviderId = "gemini" | "groq";

import type { Extraction } from "../../contracts/extraction.schema";
import type { Post } from "../../contracts/post.schema";

export type PostVariant = Post;

export interface ExtractClaimsInput {
  documentText: string;
  abstractText?: string | null;
  doi?: string | null;
}

export interface GeneratePostsInput {
  extraction: Extraction;
  audience?: string;
  preferredPlatforms?: PostVariant["platform"][];
}
