import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { handleRouteError, jsonError } from "@/src/lib/api/http";

export const runtime = "nodejs";

const paramsSchema = z.object({
  path: z.array(z.string().min(1)).min(1),
});

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  try {
    const { path: segments } = paramsSchema.parse(await context.params);
    if (segments.length !== 1) {
      return jsonError("VALIDATION_ERROR", "Invalid export path", 400);
    }

    const fileName = segments[0];
    if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
      return jsonError("VALIDATION_ERROR", "Invalid export path", 400);
    }

    const absolutePath = path.join(process.cwd(), "storage", "exports", fileName);
    const bytes = await readFile(absolutePath);
    const contentType = fileName.endsWith(".jpeg") || fileName.endsWith(".jpg") ? "image/jpeg" : "image/png";

    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "private, max-age=60",
      },
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return jsonError("NOT_FOUND", "Export file not found", 404);
    }

    return handleRouteError(error);
  }
}
