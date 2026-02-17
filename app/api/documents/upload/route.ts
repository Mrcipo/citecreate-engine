import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { handleRouteError, jsonError, jsonOk } from "@/src/lib/api/http";
import { prisma } from "@/src/lib/db/prisma";

export const runtime = "nodejs";

const uploadSchema = z.object({
  filename: z.string().trim().min(1),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonError("VALIDATION_ERROR", "Missing PDF file in field `file`", 400);
    }

    const parsedInput = uploadSchema.parse({
      filename: file.name,
    });
    const mimeType = file.type || "application/pdf";
    if (mimeType !== "application/pdf" && !parsedInput.filename.toLowerCase().endsWith(".pdf")) {
      return jsonError("VALIDATION_ERROR", "Only PDF files are supported", 400);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex");
    const fileName = `${randomUUID()}-${sanitizeFileName(parsedInput.filename)}`;
    const storageDir = path.join(process.cwd(), "storage", "pdfs");
    const storagePath = path.join(storageDir, fileName);

    await mkdir(storageDir, { recursive: true });
    await writeFile(storagePath, bytes);

    const document = await prisma.document.create({
      data: {
        filename: parsedInput.filename,
        hash,
        storagePath,
        status: "PENDING",
      },
    });

    return jsonOk(
      {
        id: document.id,
        filename: document.filename,
        status: document.status,
        createdAt: document.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
