"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DocumentListItem = {
  id: string;
  filename: string;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  createdAt: string;
  updatedAt: string;
};

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
};

export default function HomePage() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    void loadDocuments();
  }, []);

  const sortedDocuments = useMemo(
    () => [...documents].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [documents],
  );

  async function loadDocuments() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<{ documents: DocumentListItem[] }>;
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Unable to load documents");
      }

      setDocuments(payload.data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setError("Select a PDF file first.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? "Upload failed");
      }

      setSelectedFile(null);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected upload error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#1f2937_0%,#0f172a_35%,#020617_100%)] px-4 py-8 text-slate-100 md:px-10">
      <div className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-[380px_1fr]">
        <section className="rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-2xl backdrop-blur">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">CiteCreate Engine</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight">Upload & Process PDFs</h1>
          <p className="mt-3 text-sm text-slate-300">
            Subi un PDF, dispará el pipeline y seguí resultados con claims, posts y export visual.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleUpload}>
            <label className="block text-sm font-medium text-slate-200" htmlFor="pdf-file">
              PDF file
            </label>
            <input
              id="pdf-file"
              type="file"
              accept="application/pdf,.pdf"
              className="block w-full rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-3 text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-950 hover:file:bg-cyan-300"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload PDF"}
            </button>
          </form>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-400/50 bg-rose-900/30 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-700/80 bg-slate-900/65 p-6 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Documents</h2>
            <button
              type="button"
              onClick={() => void loadDocuments()}
              className="rounded-lg border border-slate-500 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-slate-300">Loading documents...</p>
          ) : sortedDocuments.length === 0 ? (
            <p className="mt-6 text-sm text-slate-300">No documents yet. Upload one to start.</p>
          ) : (
            <ul className="mt-5 grid gap-3">
              {sortedDocuments.map((document) => (
                <li key={document.id}>
                  <Link
                    href={`/documents/${document.id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 transition hover:border-cyan-300/60 hover:bg-slate-800/80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">{document.filename}</p>
                      <p className="text-xs text-slate-400">{new Date(document.createdAt).toLocaleString()}</p>
                    </div>
                    <StatusBadge status={document.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: DocumentListItem["status"] }) {
  const styles: Record<DocumentListItem["status"], string> = {
    PENDING: "bg-amber-300/20 text-amber-200 border-amber-300/40",
    PROCESSING: "bg-sky-300/20 text-sky-200 border-sky-300/40",
    READY: "bg-emerald-300/20 text-emerald-200 border-emerald-300/40",
    FAILED: "bg-rose-300/20 text-rose-200 border-rose-300/40",
  };

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${styles[status]}`}>
      {status}
    </span>
  );
}
