"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
};

type DocumentStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";

type JobRun = {
  id: string;
  stage: string;
  status: string;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
};

type DocumentStatusPayload = {
  id: string;
  status: DocumentStatus;
  updatedAt: string;
  jobRuns: JobRun[];
};

type Citation = {
  title: string;
  doi?: string;
  url?: string;
  year?: number;
  sourceUsed: boolean;
};

type Extraction = {
  claims: string[];
  population: string;
  intervention: string;
  outcomes: string;
  limitations: string;
  evidenceLevel: string;
  confidenceScore: number;
  citations: Citation[];
};

type PostVariant = {
  id: string;
  platform: "LINKEDIN" | "X" | "THREADS" | "BLUESKY";
  tone: string;
  length: string;
  contentText: string;
  createdAt: string;
};

type ResultsPayload = {
  document: {
    id: string;
    filename: string;
    status: DocumentStatus;
  };
  metadata: {
    title: string | null;
    doi: string | null;
    year: number | null;
    isOpenAccess: boolean;
    oaUrl: string | null;
  } | null;
  extraction: {
    extractedJson: Extraction | null;
  } | null;
  posts: PostVariant[];
};

const templateOptions = ["carousel_basic", "myth_vs_fact", "clinical_summary"] as const;
const platformOptions = ["linkedin", "x", "threads", "bluesky"] as const;
const toneOptions = ["neutral", "educational", "authoritative", "friendly"] as const;
const lengthOptions = ["short", "medium", "long"] as const;

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [documentId] = useState<string>(resolvedParams.id);
  const [statusData, setStatusData] = useState<DocumentStatusPayload | null>(null);
  const [resultsData, setResultsData] = useState<ResultsPayload | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string>("");
  const [editorContent, setEditorContent] = useState("");
  const [editorPlatform, setEditorPlatform] = useState<(typeof platformOptions)[number]>("linkedin");
  const [editorTone, setEditorTone] = useState<(typeof toneOptions)[number]>("neutral");
  const [editorLength, setEditorLength] = useState<(typeof lengthOptions)[number]>("medium");
  const [editorTemplate, setEditorTemplate] = useState<(typeof templateOptions)[number]>("carousel_basic");
  const [editorFormat, setEditorFormat] = useState<"png" | "jpeg">("png");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      return;
    }

    const poll = async () => {
      await Promise.all([loadStatus(documentId), loadResults(documentId)]);
    };

    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 3000);

    return () => clearInterval(timer);
  }, [documentId]);

  const selectedPost = useMemo(
    () => resultsData?.posts.find((post) => post.id === selectedPostId) ?? null,
    [resultsData?.posts, selectedPostId],
  );

  useEffect(() => {
    if (!resultsData || resultsData.posts.length === 0) {
      return;
    }

    const preferred = resultsData.posts.find((post) => post.id === selectedPostId) ?? resultsData.posts[0];
    if (!preferred) {
      return;
    }

    setSelectedPostId(preferred.id);
    setEditorContent((current) => (current && selectedPostId === preferred.id ? current : preferred.contentText));
    setEditorPlatform(toUiPlatform(preferred.platform));
    setEditorTone((preferred.tone as (typeof toneOptions)[number]) ?? "neutral");
    setEditorLength((preferred.length as (typeof lengthOptions)[number]) ?? "medium");
  }, [resultsData, selectedPostId]);

  async function loadStatus(id: string) {
    try {
      const response = await fetch(`/api/documents/${id}/status`, { cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<DocumentStatusPayload>;
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Failed loading status");
      }

      setStatusData(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status loading failed");
    }
  }

  async function loadResults(id: string) {
    try {
      const response = await fetch(`/api/documents/${id}/results`, { cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<ResultsPayload>;
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Failed loading results");
      }

      setResultsData(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Results loading failed");
    }
  }

  async function triggerProcessing() {
    if (!documentId) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/process`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sync: false }),
      });
      const payload = (await response.json()) as ApiEnvelope<{ status: string }>;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? "Process trigger failed");
      }

      setMessage("Pipeline started.");
      await loadStatus(documentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Process trigger failed");
    } finally {
      setBusy(false);
    }
  }

  async function savePostEdits() {
    if (!selectedPostId) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/posts/${selectedPostId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: editorPlatform,
          tone: editorTone,
          length: editorLength,
          contentText: editorContent,
        }),
      });
      const payload = (await response.json()) as ApiEnvelope<unknown>;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? "Could not save post");
      }

      setMessage("Post updated.");
      if (documentId) {
        await loadResults(documentId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function exportPost() {
    if (!selectedPostId) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/posts/${selectedPostId}/export`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId: editorTemplate,
          format: editorFormat,
        }),
      });
      const payload = (await response.json()) as ApiEnvelope<{ url: string; path: string }>;
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Export failed");
      }

      setMessage(`Export created: ${payload.data.path}`);
      window.open(payload.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(165deg,#0b1120_0%,#111827_35%,#020617_100%)] px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-xs uppercase tracking-[0.15em] text-cyan-300 hover:text-cyan-200">
              Back to Upload
            </Link>
            <h1 className="mt-2 text-3xl font-semibold leading-tight">
              {resultsData?.document.filename ?? "Document Workspace"}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void triggerProcessing()}
            disabled={busy || !documentId}
            className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-200 disabled:opacity-50"
          >
            Run Pipeline
          </button>
        </div>

        {(message || error) && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              error ? "border-rose-400/60 bg-rose-900/30 text-rose-100" : "border-emerald-400/60 bg-emerald-900/20 text-emerald-100"
            }`}
          >
            {error ?? message}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold">Status</h2>
            <div className="mt-3 flex items-center gap-2">
              <StatusPill status={statusData?.status ?? "PENDING"} />
              <span className="text-xs text-slate-400">
                Updated {statusData ? new Date(statusData.updatedAt).toLocaleTimeString() : "--:--"}
              </span>
            </div>
            <ul className="mt-4 space-y-2">
              {statusData?.jobRuns.map((run) => (
                <li key={run.id} className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{run.stage}</span>
                    <span className="text-slate-400">{run.status}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {run.durationMs != null ? `${run.durationMs} ms` : "running..."}
                  </p>
                  {run.errorMessage && <p className="mt-2 text-xs text-rose-300">{run.errorMessage}</p>}
                </li>
              ))}
            </ul>
          </aside>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-5">
              <h2 className="text-lg font-semibold">Results</h2>
              <p className="mt-1 text-sm text-slate-300">
                DOI: {resultsData?.metadata?.doi ?? "N/A"} | OA:{" "}
                {resultsData?.metadata?.isOpenAccess ? "Yes" : "No / Unknown"}
              </p>
              <ul className="mt-4 grid gap-2">
                {resultsData?.extraction?.extractedJson?.claims?.map((claim, index) => (
                  <li key={`${index}-${claim}`} className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm">
                    {claim}
                  </li>
                )) ?? <li className="text-sm text-slate-400">No extraction yet.</li>}
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Post Editor</h2>
                <select
                  value={selectedPostId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setSelectedPostId(id);
                    const post = resultsData?.posts.find((item) => item.id === id);
                    if (!post) return;
                    setEditorContent(post.contentText);
                    setEditorPlatform(toUiPlatform(post.platform));
                    setEditorTone((post.tone as (typeof toneOptions)[number]) ?? "neutral");
                    setEditorLength((post.length as (typeof lengthOptions)[number]) ?? "medium");
                  }}
                  className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
                >
                  {(resultsData?.posts ?? []).map((post) => (
                    <option key={post.id} value={post.id}>
                      {toUiPlatform(post.platform)} - {new Date(post.createdAt).toLocaleTimeString()}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPost ? (
                <>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <SelectField label="Platform" value={editorPlatform} onChange={setEditorPlatform} options={platformOptions} />
                    <SelectField label="Tone" value={editorTone} onChange={setEditorTone} options={toneOptions} />
                    <SelectField label="Length" value={editorLength} onChange={setEditorLength} options={lengthOptions} />
                    <SelectField label="Template" value={editorTemplate} onChange={setEditorTemplate} options={templateOptions} />
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="contentText">
                      contentText
                    </label>
                    <textarea
                      id="contentText"
                      rows={8}
                      value={editorContent}
                      onChange={(event) => setEditorContent(event.target.value)}
                      className="w-full rounded-xl border border-slate-600 bg-slate-950/80 px-3 py-3 text-sm leading-relaxed text-slate-100"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <select
                      value={editorFormat}
                      onChange={(event) => setEditorFormat(event.target.value as "png" | "jpeg")}
                      className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
                    >
                      <option value="png">PNG</option>
                      <option value="jpeg">JPEG</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void savePostEdits()}
                      disabled={busy}
                      className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportPost()}
                      disabled={busy}
                      className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-200 disabled:opacity-50"
                    >
                      Export
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-400">No post variants available yet.</p>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: readonly T[];
}) {
  return (
    <label className="text-xs text-slate-300">
      <span className="mb-1 block uppercase tracking-[0.12em]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusPill({ status }: { status: DocumentStatus }) {
  const styleMap: Record<DocumentStatus, string> = {
    PENDING: "border-amber-300/40 bg-amber-300/20 text-amber-100",
    PROCESSING: "border-sky-300/40 bg-sky-300/20 text-sky-100",
    READY: "border-emerald-300/40 bg-emerald-300/20 text-emerald-100",
    FAILED: "border-rose-300/40 bg-rose-300/20 text-rose-100",
  };

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${styleMap[status]}`}>{status}</span>;
}

function toUiPlatform(platform: PostVariant["platform"]) {
  switch (platform) {
    case "LINKEDIN":
      return "linkedin";
    case "X":
      return "x";
    case "THREADS":
      return "threads";
    case "BLUESKY":
      return "bluesky";
  }
}
