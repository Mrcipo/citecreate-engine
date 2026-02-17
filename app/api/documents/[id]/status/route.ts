import { z } from "zod";

import { handleRouteError, jsonError, jsonOk } from "@/src/lib/api/http";
import { prisma } from "@/src/lib/db/prisma";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().trim().min(1),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        jobRuns: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!document) {
      return jsonError("NOT_FOUND", "Document not found", 404);
    }

    return jsonOk({
      id: document.id,
      status: document.status,
      updatedAt: document.updatedAt,
      jobRuns: document.jobRuns.map((job) => ({
        id: job.id,
        stage: job.stage,
        status: job.status,
        durationMs: job.durationMs,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
