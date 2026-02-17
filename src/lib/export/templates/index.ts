import { renderCarouselBasicTemplate } from "./carousel_basic";
import { renderClinicalSummaryTemplate } from "./clinical_summary";
import { renderMythVsFactTemplate } from "./myth_vs_fact";

export interface ExportTemplateRenderData {
  platform: string;
  contentText: string;
  citationSummary: string;
}

export type ExportTemplateId = "carousel_basic" | "myth_vs_fact" | "clinical_summary";
export type ExportTemplateRenderer = (data: ExportTemplateRenderData) => string;

export const templateRegistry: Record<ExportTemplateId, ExportTemplateRenderer> = {
  carousel_basic: renderCarouselBasicTemplate,
  myth_vs_fact: renderMythVsFactTemplate,
  clinical_summary: renderClinicalSummaryTemplate,
};

export function isTemplateId(value: string): value is ExportTemplateId {
  return value in templateRegistry;
}
