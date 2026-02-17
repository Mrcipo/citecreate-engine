import { z } from "zod";

import { handleRouteError, jsonError, jsonOk } from "@/src/lib/api/http";
import { prisma } from "@/src/lib/db/prisma";
import { createRenderService } from "@/src/lib/export/render.service";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().trim().min(1),
});

const bodySchema = z
  .object({
    templateId: z.string().trim().min(1),
    format: z.enum(["png", "jpeg"]),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const body = bodySchema.parse(await request.json());

    const postVariant = await prisma.postVariant.findUnique({ where: { id } });
    if (!postVariant) {
      return jsonError("NOT_FOUND", "PostVariant not found", 404);
    }

    const renderService = createRenderService({ prisma });
    const rendered = await renderService.renderPostVariant({
      postVariantId: postVariant.id,
      templateId: body.templateId,
      format: body.format,
    });

    return jsonOk(
      {
        id: rendered.exportRecord.id,
        postVariantId: rendered.exportRecord.postVariantId,
        templateId: rendered.exportRecord.templateId,
        format: rendered.exportRecord.format,
        imagePath: rendered.exportRecord.imagePath,
        path: rendered.localPath,
        url: rendered.localUrl,
        createdAt: rendered.exportRecord.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
