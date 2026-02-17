import type { ExportTemplateRenderData } from "./index";

export function renderMythVsFactTemplate(data: ExportTemplateRenderData): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Myth vs Fact</title>
    <style>${styles()}</style>
  </head>
  <body class="bg-zinc-950 text-zinc-100 w-[1080px] h-[1080px]">
    <main class="h-full p-14 grid grid-cols-2 gap-6">
      <section class="panel myth">
        <h1 class="eyebrow">Myth</h1>
        <p class="copy">${escapeHtml(sliceText(data.contentText, 260))}</p>
      </section>
      <section class="panel fact">
        <h1 class="eyebrow">Fact</h1>
        <p class="copy">${escapeHtml(data.citationSummary)}</p>
      </section>
      <footer class="footer col-span-2">
        <span class="tag">${escapeHtml(data.platform.toUpperCase())}</span>
        <span class="tag">Template: myth_vs_fact</span>
      </footer>
    </main>
  </body>
</html>`;
}

function styles(): string {
  return `
* { box-sizing: border-box; }
body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; }
.w-\\[1080px\\] { width:1080px; }
.h-\\[1080px\\] { height:1080px; }
.h-full { height:100%; }
.p-14 { padding:3.5rem; }
.grid { display:grid; }
.grid-cols-2 { grid-template-columns:1fr 1fr; }
.gap-6 { gap:1.5rem; }
.col-span-2 { grid-column:span 2 / span 2; }
.bg-zinc-950 { background:#09090b; }
.text-zinc-100 { color:#f4f4f5; }
.panel { border-radius:18px; padding:2.2rem; display:flex; flex-direction:column; gap:1.2rem; }
.myth { background:#3f1d2e; border:1px solid #9f1239; }
.fact { background:#052e16; border:1px solid #22c55e; }
.eyebrow { margin:0; font-size:2.4rem; text-transform:uppercase; letter-spacing:.08em; }
.copy { margin:0; font-size:1.45rem; line-height:1.55; }
.footer { display:flex; justify-content:space-between; align-items:center; padding:1.2rem 1.6rem; border-radius:14px; border:1px solid #3f3f46; background:#18181b; }
.tag { font-size:.9rem; letter-spacing:.04em; text-transform:uppercase; color:#d4d4d8; }
`;
}

function sliceText(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
