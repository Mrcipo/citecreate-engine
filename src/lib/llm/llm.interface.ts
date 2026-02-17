import type { LlmProviderId } from "./llm.types";
import type { Extraction } from "../../contracts/extraction.schema";
import type { ExtractClaimsInput, GeneratePostsInput, PostVariant } from "./llm.types";

export interface LlmProvider {
  readonly id: LlmProviderId;
  extractClaims(input: ExtractClaimsInput): Promise<Extraction>;
  generatePosts(input: GeneratePostsInput): Promise<PostVariant[]>;
}
