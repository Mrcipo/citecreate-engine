const DOI_REGEX = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/gi;
const TRAILING_PUNCTUATION_REGEX = /[).,;]+$/g;

export function extractDois(content: string): string[] {
  const matches = content.match(DOI_REGEX) ?? [];
  const unique = new Set<string>();

  for (const rawDoi of matches) {
    const normalized = normalizeDoi(rawDoi);
    if (normalized) {
      unique.add(normalized);
    }
  }

  return [...unique];
}

export function detectDoi(content: string): string | null {
  const [first] = extractDois(content);
  return first ?? null;
}

function normalizeDoi(rawDoi: string): string | null {
  const trimmed = rawDoi.trim().replace(TRAILING_PUNCTUATION_REGEX, "");
  if (!trimmed) {
    return null;
  }

  return trimmed.toLowerCase();
}
