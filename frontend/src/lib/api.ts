import { API_BASE } from "@/lib/config";

export type IngestStage = {
  key: string;
  label: string;
  status: "pending" | "running" | "completed" | string;
  at?: number;
};

export type IngestJob = {
  id: string;
  document_id: string;
  status: string;
  stages: IngestStage[];
  error: string | null;
  result: {
    chunk_count: number;
    page_count: number;
    embedding_model: string;
    ingestion_duration_ms: number;
  } | null;
};

export type WorkspaceDocument = {
  document_id: string;
  filename: string;
  status: string;
  page_count: number;
  chunk_count: number;
  embedding_model: string;
  ingestion_duration_ms: number | null;
  created_at: number;
  updated_at: number;
  error: string | null;
};

export async function fetchDocuments(): Promise<WorkspaceDocument[]> {
  const res = await fetch(`${API_BASE}/api/documents`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.documents ?? [];
}

export async function fetchJob(jobId: string): Promise<IngestJob> {
  const res = await fetch(`${API_BASE}/api/ingest/jobs/${jobId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function uploadPdfWithProgress(
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ document_id: string; filename: string; job_id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/documents/upload`);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };
    xhr.onload = () => {
      let payload: unknown;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload && typeof payload === "object") {
        resolve(payload as { document_id: string; filename: string; job_id: string });
        return;
      }
      const detail = (payload as { detail?: string | { msg?: string }[] })?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? JSON.stringify(detail)
            : xhr.statusText || "Upload failed";
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}

export async function postQuery(body: {
  query: string;
  top_k: number;
  reranker_enabled: boolean;
  retrieval_mode: string;
}) {
  const res = await fetch(`${API_BASE}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function documentPdfUrl(documentId: string) {
  return `${API_BASE}/api/documents/${documentId}/file`;
}
