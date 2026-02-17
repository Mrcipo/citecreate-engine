import { z } from "zod";

const doiSchema = z
  .string()
  .regex(/^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i, "Invalid DOI format");

const citationSchema = z
  .object({
    title: z.string().min(1),
    doi: doiSchema.optional(),
    url: z.url().optional(),
    year: z.number().int().min(1800).max(2100).optional(),
    sourceUsed: z.boolean(),
  })
  .strict();

export const extractionSchema = z
  .object({
    claims: z.array(z.string().min(1)).min(3).max(7),
    population: z.string().min(1),
    intervention: z.string().min(1),
    outcomes: z.string().min(1),
    limitations: z.string().min(1),
    evidenceLevel: z.string().min(1),
    confidenceScore: z.number().min(0).max(1),
    citations: z.array(citationSchema).min(1),
  })
  .strict();

export type Citation = z.infer<typeof citationSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
