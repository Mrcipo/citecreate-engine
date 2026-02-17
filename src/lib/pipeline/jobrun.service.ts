import type { JobRun, JobStage, PrismaClient } from "@prisma/client";

export interface JobRunService {
  runStage<T>(documentId: string, stage: JobStage, runner: () => Promise<T>): Promise<T>;
}

interface JobRunServiceOptions {
  prisma: PrismaClient;
}

export function createJobRunService(options: JobRunServiceOptions): JobRunService {
  const { prisma } = options;

  return {
    async runStage<T>(documentId: string, stage: JobStage, runner: () => Promise<T>): Promise<T> {
      const startedAt = Date.now();
      const jobRun = await prisma.jobRun.create({
        data: {
          documentId,
          stage,
          status: "RUNNING",
        },
      });

      try {
        const result = await runner();
        await markSucceeded(prisma, jobRun, startedAt);
        return result;
      } catch (error) {
        await markFailed(prisma, jobRun, startedAt, error);
        throw error;
      }
    },
  };
}

async function markSucceeded(prisma: PrismaClient, jobRun: JobRun, startedAt: number): Promise<void> {
  await prisma.jobRun.update({
    where: { id: jobRun.id },
    data: {
      status: "SUCCEEDED",
      durationMs: Date.now() - startedAt,
      errorMessage: null,
    },
  });
}

async function markFailed(
  prisma: PrismaClient,
  jobRun: JobRun,
  startedAt: number,
  error: unknown,
): Promise<void> {
  await prisma.jobRun.update({
    where: { id: jobRun.id },
    data: {
      status: "FAILED",
      durationMs: Date.now() - startedAt,
      errorMessage: formatErrorMessage(error),
    },
  });
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 1000);
  }

  return "Unknown pipeline error";
}
