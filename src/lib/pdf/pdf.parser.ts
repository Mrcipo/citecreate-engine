import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import { PDFParse } from "pdf-parse";

export interface ParsedPdf {
  text: string;
  abstractText: string | null;
}

export interface PdfParser {
  parse(buffer: Buffer): Promise<ParsedPdf>;
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  ensurePdfWorkerConfigured();
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return normalizeText(parsed.text);
  } finally {
    await parser.destroy();
  }
}

export function extractAbstract(text: string, maxLength = 2500): string | null {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }

  const startMatch = normalized.match(/(?:^|\n)\s*(?:abstract|resumen)\s*:?\s*/i);
  if (!startMatch || startMatch.index === undefined) {
    return null;
  }

  const start = startMatch.index + startMatch[0].length;
  const afterStart = normalized.slice(start);
  const endMatch = afterStart.match(
    /(?:^|\n)\s*(?:\d+\s*(?:[.)]\s*)?)?(?:introduction|introduccion|introducción)\b/i,
  );

  const end = endMatch && endMatch.index !== undefined ? endMatch.index : maxLength;
  const sliced = afterStart.slice(0, Math.min(end, maxLength)).trim();
  return sliced.length > 0 ? sliced : null;
}

export function createPdfParser(): PdfParser {
  return {
    async parse(buffer: Buffer): Promise<ParsedPdf> {
      const text = await extractTextFromPdfBuffer(buffer);
      return {
        text,
        abstractText: extractAbstract(text),
      };
    },
  };
}

function normalizeText(value: string): string {
  return value.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

let pdfWorkerConfigured = false;

function ensurePdfWorkerConfigured(): void {
  if (pdfWorkerConfigured) {
    return;
  }

  // In Next.js server runtimes, pdf.js may try to resolve the worker relative
  // to compiled chunks. Set an absolute local worker URL to avoid .next chunk lookups.
  try {
    const require = createRequire(import.meta.url);
    const workerPath = resolveWorkerPath(require);
    PDFParse.setWorker(pathToFileURL(workerPath).toString());
  } catch {
    // Best-effort: keep default behavior if resolution fails.
  } finally {
    pdfWorkerConfigured = true;
  }
}

function resolveWorkerPath(require: NodeRequire): string {
  const candidates = ["pdfjs-dist/legacy/build/pdf.worker.mjs", "pdfjs-dist/build/pdf.worker.mjs"];
  for (const candidate of candidates) {
    try {
      return require.resolve(candidate);
    } catch {
      // Try next candidate.
    }
  }

  throw new Error("pdf.worker.mjs not found in pdfjs-dist");
}
