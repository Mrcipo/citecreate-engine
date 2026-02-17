import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { Export, PrismaClient } from "@prisma/client";
import { chromium } from "playwright";

import { AppError } from "../errors";
import { isTemplateId, templateRegistry } from "./templates";

export interface RenderExportInput {
  postVariantId: string;
  templateId: string;
  format: "png" | "jpeg";
}

export interface RenderedExportResult {
  exportRecord: Export;
  localPath: string;
  localUrl: string;
}

export interface RenderService {
  renderPostVariant(input: RenderExportInput): Promise<RenderedExportResult>;
}

interface RenderServiceOptions {
  prisma: PrismaClient;
}

export function createRenderService(options: RenderServiceOptions): RenderService {
  const { prisma } = options;

  return {
    async renderPostVariant(input: RenderExportInput): Promise<RenderedExportResult> {
      if (!isTemplateId(input.templateId)) {
        throw new AppError(`Unsupported templateId: ${input.templateId}`);
      }

      const postVariant = await prisma.postVariant.findUnique({
        where: { id: input.postVariantId },
      });
      if (!postVariant) {
        throw new AppError(`PostVariant not found: ${input.postVariantId}`);
      }

      const renderer = templateRegistry[input.templateId];
      const html = renderer({
        platform: postVariant.platform.toLowerCase(),
        contentText: postVariant.contentText,
        citationSummary: summarizeCitations(postVariant.citationsJson),
      });

      const exportsDir = path.join(process.cwd(), "storage", "exports");
      await mkdir(exportsDir, { recursive: true });
      const fileName = `${postVariant.id}-${Date.now()}-${input.templateId}.${input.format}`;
      const absolutePath = path.join(exportsDir, fileName);
      const relativePath = path.join("storage", "exports", fileName).replaceAll("\\", "/");

      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({
          viewport: { width: 1080, height: 1350 },
          deviceScaleFactor: 2,
        });
        await page.setContent(html, { waitUntil: "networkidle" });
        await page.screenshot({
          path: absolutePath,
          type: input.format,
          fullPage: true,
        });
      } finally {
        await browser.close();
      }

      const exportRecord = await prisma.export.create({
        data: {
          postVariantId: input.postVariantId,
          templateId: input.templateId,
          format: input.format,
          imagePath: relativePath,
        },
      });

      return {
        exportRecord,
        localPath: relativePath,
        localUrl: `/api/exports/${fileName}`,
      };
    },
  };
}

function summarizeCitations(value: unknown): string {
  if (!Array.isArray(value)) {
    return "No citation metadata available.";
  }

  const titles = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const title = (entry as { title?: unknown }).title;
      return typeof title === "string" ? title.trim() : null;
    })
    .filter((title): title is string => Boolean(title));

  if (titles.length === 0) {
    return "No citation metadata available.";
  }

  return `Sources: ${titles.slice(0, 3).join(" | ")}`;
}
