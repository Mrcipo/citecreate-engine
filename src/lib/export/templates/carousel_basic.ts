import type { ExportTemplateRenderData } from "./index";

export function renderCarouselBasicTemplate(data: ExportTemplateRenderData): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Carousel Basic</title>
    <style>${baseStyles()}</style>
  </head>
  <body class="bg-slate-950 text-slate-100 w-[1080px] h-[1350px]">
    <main class="h-full p-16 flex flex-col gap-10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950">
      <div class="flex items-center justify-between">
        <span class="text-xs tracking-wide uppercase text-cyan-300">CiteCreate Engine</span>
        <span class="text-xs text-slate-300">${escapeHtml(data.platform.toUpperCase())}</span>
      </div>
      <section class="rounded-2xl border border-slate-700 p-10 bg-slate-900/60 shadow-lg">
        <h1 class="text-5xl leading-tight font-bold mb-6">Clinical Insight Snapshot</h1>
        <p class="text-2xl leading-relaxed text-slate-200">${escapeHtml(data.contentText)}</p>
      </section>
      <section class="rounded-2xl border border-cyan-700/40 p-8 bg-slate-900/70">
        <h2 class="text-sm uppercase tracking-wide text-cyan-200 mb-4">Source Highlights</h2>
        <p class="text-lg text-slate-200">${escapeHtml(data.citationSummary)}</p>
      </section>
    </main>
  </body>
</html>`;
}

function baseStyles(): string {
  return `
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; }
.bg-slate-950 { background:#020617; }
.bg-slate-900\\/60 { background:rgba(15,23,42,.6); }
.bg-slate-900\\/70 { background:rgba(15,23,42,.7); }
.text-slate-100 { color:#f1f5f9; }
.text-slate-200 { color:#e2e8f0; }
.text-slate-300 { color:#cbd5e1; }
.text-cyan-300 { color:#67e8f9; }
.text-cyan-200 { color:#a5f3fc; }
.w-\\[1080px\\] { width:1080px; }
.h-\\[1350px\\] { height:1350px; }
.h-full { height:100%; }
.p-16 { padding:4rem; }
.p-10 { padding:2.5rem; }
.p-8 { padding:2rem; }
.mb-6 { margin-bottom:1.5rem; }
.mb-4 { margin-bottom:1rem; }
.flex { display:flex; }
.flex-col { flex-direction:column; }
.items-center { align-items:center; }
.justify-between { justify-content:space-between; }
.gap-10 { gap:2.5rem; }
.rounded-2xl { border-radius:1rem; }
.border { border-width:1px; border-style:solid; }
.border-slate-700 { border-color:#334155; }
.border-cyan-700\\/40 { border-color:rgba(14,116,144,.4); }
.shadow-lg { box-shadow:0 10px 20px rgba(2,6,23,.35); }
.text-xs { font-size:.75rem; line-height:1rem; }
.text-sm { font-size:.875rem; line-height:1.25rem; }
.text-lg { font-size:1.125rem; line-height:1.75rem; }
.text-2xl { font-size:1.5rem; line-height:2rem; }
.text-5xl { font-size:3rem; line-height:1; }
.leading-tight { line-height:1.2; }
.leading-relaxed { line-height:1.65; }
.font-bold { font-weight:700; }
.tracking-wide { letter-spacing:.08em; }
.uppercase { text-transform:uppercase; }
.bg-gradient-to-br { background-image:linear-gradient(to bottom right,var(--tw-gradient-stops)); }
.from-slate-900 { --tw-gradient-stops:#0f172a, var(--tw-gradient-to); }
.via-slate-800 { --tw-gradient-stops:#0f172a,#1e293b,var(--tw-gradient-to); }
.to-slate-950 { --tw-gradient-to:#020617; }
`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
