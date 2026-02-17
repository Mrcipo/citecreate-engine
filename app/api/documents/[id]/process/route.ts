import { z } from "zod";

import { handleRouteError, jsonError, jsonOk } from "@/src/lib/api/http";
import { prisma } from "@/src/lib/db/prisma";
import { createPipelineService } from "@/src/lib/pipeline/pipeline.service";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().trim().min(1),
});

const processBodySchema = z
  .object({
    sync: z.boolean().optional(),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const body = await readJsonBody(request, processBodySchema);

    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) {
      return jsonError("NOT_FOUND", "Document not found", 404);
    }

    const pipeline = createPipelineService({ prisma });
    if (body.sync === true) {
      await pipeline.run(id);
      const updated = await prisma.document.findUniqueOrThrow({ where: { id } });
      return jsonOk({ id, status: updated.status });
    }

    void pipeline.run(id).catch(async () => {
      await prisma.document.update({
        where: { id },
        data: { status: "FAILED" },
      });
    });

    return jsonOk({ id, status: "PROCESSING" });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function readJsonBody<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return schema.parse({});
  }

  return schema.parse(await request.json());
}
