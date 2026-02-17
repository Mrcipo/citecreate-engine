import { handleRouteError, jsonOk } from "@/src/lib/api/http";
import { prisma } from "@/src/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return jsonOk({
      documents: documents.map((document) => ({
        id: document.id,
        filename: document.filename,
        status: document.status,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
