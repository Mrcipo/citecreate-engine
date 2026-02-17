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
        metadata: true,
        extraction: true,
        postVariants: {
          include: {
            exports: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!document) {
      return jsonError("NOT_FOUND", "Document not found", 404);
    }

    return jsonOk({
      document: {
        id: document.id,
        filename: document.filename,
        status: document.status,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      },
      metadata: document.metadata,
      extraction: document.extraction,
      posts: document.postVariants,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
