import { z } from "zod";

import { handleRouteError, jsonError, jsonOk } from "@/src/lib/api/http";
import { prisma } from "@/src/lib/db/prisma";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().trim().min(1),
});

const bodySchema = z
  .object({
    platform: z.enum(["linkedin", "x", "threads", "bluesky"]).optional(),
    tone: z.string().trim().min(1).optional(),
    length: z.string().trim().min(1).optional(),
    contentText: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const body = bodySchema.parse(await request.json());

    const existing = await prisma.postVariant.findUnique({ where: { id } });
    if (!existing) {
      return jsonError("NOT_FOUND", "PostVariant not found", 404);
    }

    const updated = await prisma.postVariant.update({
      where: { id },
      data: {
        platform: body.platform ? mapPlatform(body.platform) : undefined,
        tone: body.tone,
        length: body.length,
        contentText: body.contentText,
      },
    });

    return jsonOk({
      id: updated.id,
      documentId: updated.documentId,
      platform: updated.platform.toLowerCase(),
      tone: updated.tone,
      length: updated.length,
      contentText: updated.contentText,
      createdAt: updated.createdAt,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function mapPlatform(value: "linkedin" | "x" | "threads" | "bluesky") {
  switch (value) {
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
