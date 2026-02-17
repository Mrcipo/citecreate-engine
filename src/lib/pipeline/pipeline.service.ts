import { readFile } from "node:fs/promises";

import { Prisma, PrismaClient, type Document, type Platform } from "@prisma/client";

import { createCrossrefClient, type CrossrefClient } from "../external/crossref.client";
import { createUnpaywallClient, type UnpaywallClient } from "../external/unpaywall.client";
import type { LlmProvider } from "../llm/llm.interface";
import { llmRouter } from "../llm/llm.router";
import { createPdfParser, type PdfParser } from "../pdf/pdf.parser";
import { detectDoi } from "../pdf/doi.detect";
import { createJobRunService, type JobRunService } from "./jobrun.service";
import type { Extraction } from "../../contracts/extraction.schema";

const MAX_LLM_INPUT_CHARS = 12_000;
const SAFE_SNIPPET_CHARS = 2_500;
const EXTRACTION_SCHEMA_VERSION = "1.0.0";

export interface PipelineService {
  run(documentId: string): Promise<void>;
}

interface PipelineServiceOptions {
  prisma?: PrismaClient;
  pdfParser?: PdfParser;
  crossrefClient?: CrossrefClient;
  unpaywallClient?: UnpaywallClient;
  llmProvider?: LlmProvider;
  jobRunService?: JobRunService;
}

interface ParsedStageResult {
  document: Document;
  fullText: string;
  abstractText: string | null;
  detectedDoi: string | null;
}

interface EnrichmentStageResult {
  doi: string | null;
  isOpenAccess: boolean | null;
}

export function createPipelineService(options: PipelineServiceOptions = {}): PipelineService {
  const prisma = options.prisma ?? new PrismaClient();
  const pdfParser = options.pdfParser ?? createPdfParser();
  const crossrefClient = options.crossrefClient ?? createCrossrefClient();
  const unpaywallClient = options.unpaywallClient ?? createUnpaywallClient();
  const llmProvider = options.llmProvider ?? llmRouter;
  const jobRunService = options.jobRunService ?? createJobRunService({ prisma });

  return {
    async run(documentId: string): Promise<void> {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "PROCESSING" },
      });

      try {
        const parsed = await jobRunService.runStage(documentId, "PARSE_PDF", async () =>
          parseDocument(prisma, pdfParser, documentId),
        );
        const enrichment = await jobRunService.runStage(documentId, "METADATA_ENRICH", async () =>
          enrichMetadata(prisma, crossrefClient, unpaywallClient, parsed),
        );
        const extraction = await jobRunService.runStage(documentId, "EXTRACTION", async () =>
          extractClaims(prisma, llmProvider, documentId, parsed, enrichment),
        );
        await jobRunService.runStage(documentId, "POST_GENERATION", async () =>
          generatePosts(prisma, llmProvider, documentId, extraction),
        );
        await jobRunService.runStage(documentId, "EXPORT_RENDER", async () => {
          // TODO: Wire RenderService and persist Export rows when templates/rendering are defined.
        });

        await prisma.document.update({
          where: { id: documentId },
          data: { status: "READY" },
        });
      } catch (error) {
        await prisma.document.update({
          where: { id: documentId },
          data: { status: "FAILED" },
        });
        throw error;
      }
    },
  };
}

async function parseDocument(
  prisma: PrismaClient,
  pdfParser: PdfParser,
  documentId: string,
): Promise<ParsedStageResult> {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) {
    throw new Error(`Document not found: ${documentId}`);
  }

  const buffer = await readFile(document.storagePath);
  const parsed = await pdfParser.parse(buffer);

  return {
    document,
    fullText: parsed.text,
    abstractText: parsed.abstractText,
    detectedDoi: detectDoi(parsed.text),
  };
}

async function enrichMetadata(
  prisma: PrismaClient,
  crossrefClient: CrossrefClient,
  unpaywallClient: UnpaywallClient,
  parsed: ParsedStageResult,
): Promise<EnrichmentStageResult> {
  const existing = await prisma.documentMetadata.findUnique({
    where: { documentId: parsed.document.id },
  });
  const doi = parsed.detectedDoi ?? existing?.doi ?? null;

  let crossref: Awaited<ReturnType<CrossrefClient["findByDoi"]>> | null = null;
  let openAccess: Awaited<ReturnType<UnpaywallClient["findByDoi"]>> | null = null;

  if (doi) {
    crossref = await crossrefClient.findByDoi(doi);

    try {
      openAccess = await unpaywallClient.findByDoi(doi);
    } catch {
      // TODO: capture non-fatal enrichment warnings in a diagnostics table/log sink.
      openAccess = null;
    }
  }

  const metadataData: Prisma.DocumentMetadataUncheckedCreateInput = {
    documentId: parsed.document.id,
    title: crossref?.title ?? existing?.title ?? null,
    authorsJson: crossref?.authors ?? existing?.authorsJson ?? Prisma.JsonNull,
    year: crossref?.year ?? existing?.year ?? null,
    doi: crossref?.doi ?? doi,
    url: crossref?.url ?? existing?.url ?? null,
    isOpenAccess: openAccess?.isOpenAccess ?? existing?.isOpenAccess ?? false,
    oaUrl: openAccess?.oaUrl ?? existing?.oaUrl ?? null,
    retractionStatus: existing?.retractionStatus ?? null,
  };

  await prisma.documentMetadata.upsert({
    where: { documentId: parsed.document.id },
    create: metadataData,
    update: metadataData,
  });

  return {
    doi: metadataData.doi ?? null,
    isOpenAccess: openAccess?.isOpenAccess ?? existing?.isOpenAccess ?? null,
  };
}

async function extractClaims(
  prisma: PrismaClient,
  llmProvider: LlmProvider,
  documentId: string,
  parsed: ParsedStageResult,
  enrichment: EnrichmentStageResult,
): Promise<Extraction> {
  const textForLlm = buildTextForLlm(parsed.fullText, parsed.abstractText, enrichment.isOpenAccess);
  const extraction = await llmProvider.extractClaims({
    documentText: textForLlm,
    abstractText: parsed.abstractText,
    doi: enrichment.doi,
  });

  await prisma.extraction.upsert({
    where: { documentId },
    create: {
      documentId,
      extractedJson: extraction,
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
      confidenceScore: extraction.confidenceScore,
    },
    update: {
      extractedJson: extraction,
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
      confidenceScore: extraction.confidenceScore,
    },
  });

  return extraction;
}

async function generatePosts(
  prisma: PrismaClient,
  llmProvider: LlmProvider,
  documentId: string,
  extraction: Extraction,
): Promise<void> {
  const posts = await llmProvider.generatePosts({ extraction });

  await prisma.postVariant.deleteMany({ where: { documentId } });
  await prisma.postVariant.createMany({
    data: posts.map((post) => ({
      documentId,
      platform: mapPostPlatform(post.platform),
      tone: "neutral",
      length: estimateLength(post.contentText),
      contentText: post.contentText,
      citationsJson: extraction.citations,
    })),
  });
}

function buildTextForLlm(fullText: string, abstractText: string | null, isOpenAccess: boolean | null): string {
  const normalizedFull = fullText.trim();
  const normalizedAbstract = abstractText?.trim() ?? "";

  if (isOpenAccess !== true) {
    const safeText = normalizedAbstract || normalizedFull.slice(0, SAFE_SNIPPET_CHARS);
    return safeText.slice(0, MAX_LLM_INPUT_CHARS);
  }

  return normalizedFull.slice(0, MAX_LLM_INPUT_CHARS);
}

function mapPostPlatform(platform: "linkedin" | "x" | "threads" | "bluesky"): Platform {
  switch (platform) {
    case "linkedin":
      return "LINKEDIN";
    case "x":
      return "X";
    case "threads":
      return "THREADS";
    case "bluesky":
      return "BLUESKY";
  }
}

function estimateLength(content: string): string {
  if (content.length < 280) {
    return "short";
  }

  if (content.length < 900) {
    return "medium";
  }

  return "long";
}
