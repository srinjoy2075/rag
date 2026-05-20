"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BookOpen,
  ChevronRight,
  Database,
  FileText,
  Layers,
  Search,
  Settings,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  documentPdfUrl,
  fetchDocuments,
  fetchJob,
  postQuery,
  uploadPdfWithProgress,
  type IngestJob,
  type WorkspaceDocument,
} from "@/lib/api";
import { API_BASE } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
  ProgressValue,
} from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const PdfViewerPane = dynamic(() => import("./pdf-viewer-pane"), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full rounded-lg" />,
});

function fmtNum(n: unknown): string {
  if (n == null || typeof n !== "number" || Number.isNaN(n)) return "—";
  return n.toFixed(4);
}

function displayPage(page: unknown): string {
  if (page == null || typeof page !== "number") return "—";
  return String(page + 1);
}

type Preview = {
  documentId: string;
  filename: string;
  page0: number;
  chunkText: string;
  chunkId?: string;
  scores: Record<string, unknown>;
};

export function RagWorkspace() {
  const [activeTab, setActiveTab] = useState<"documents" | "query" | "metrics">("documents");
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

  const [uploadPct, setUploadPct] = useState(0);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [activeJob, setActiveJob] = useState<IngestJob | null>(null);

  const [query, setQuery] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [settings, setSettings] = useState({
    top_k: 5,
    reranker_enabled: true,
    retrieval_mode: "hybrid",
  });

  const [preview, setPreview] = useState<Preview | null>(null);

  const refreshDocuments = useCallback(async () => {
    try {
      setDocsLoading(true);
      const list = await fetchDocuments();
      setDocuments(list);
    } catch (e) {
      console.error(e);
      toast.error("Could not load documents", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  const pollUntilDone = useCallback(async (jobId: string) => {
    const deadline = Date.now() + 15 * 60_000;
    while (Date.now() < deadline) {
      const job = await fetchJob(jobId);
      setActiveJob(job);
      if (job.status === "completed" || job.status === "failed") {
        await refreshDocuments();
        if (job.status === "failed") {
          toast.error("Ingestion failed", { description: job.error ?? "" });
        } else {
          toast.success("Document indexed", {
            description: `${job.result?.chunk_count ?? 0} chunks ready for retrieval.`,
          });
        }
        return;
      }
      await new Promise((r) => setTimeout(r, 450));
    }
    toast.warning("Ingestion is taking longer than expected", {
      description: "Refresh the document list in a moment.",
    });
  }, [refreshDocuments]);

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (!list.length) {
      toast.message("Please drop PDF files only.");
      return;
    }
    setUploadBusy(true);
    for (const file of list) {
      setUploadPct(0);
      setActiveJob(null);
      try {
        const { job_id } = await uploadPdfWithProgress(file, setUploadPct);
        toast.info("Upload complete", { description: "Indexing in the background…" });
        await pollUntilDone(job_id);
      } catch (e) {
        toast.error(`Upload failed: ${file.name}`, {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    }
    setUploadPct(0);
    setUploadBusy(false);
    setActiveJob(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void handleFiles(e.dataTransfer.files);
  };

  const runQuery = async () => {
    if (!query.trim()) return;
    setQueryLoading(true);
    setResults(null);
    try {
      const data = await postQuery({
        query: query.trim(),
        top_k: settings.top_k,
        reranker_enabled: settings.reranker_enabled,
        retrieval_mode: settings.retrieval_mode,
      });
      setResults(data);
    } catch (e) {
      toast.error("Query failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setQueryLoading(false);
    }
  };

  const openPreviewFromSource = (src: Record<string, unknown>) => {
    const documentId = src.document_id as string | undefined;
    if (!documentId) {
      toast.message("No document link", {
        description: "This chunk is not tied to an uploaded PDF in the index.",
      });
      return;
    }
    const page0 = typeof src.page === "number" ? src.page : 0;
    setPreview({
      documentId,
      filename: (src.filename as string) || "document.pdf",
      page0,
      chunkText: String(src.text ?? ""),
      chunkId: src.chunk_id as string | undefined,
      scores: {
        retrieval_score: src.score,
        rrf_score: src.rrf_score,
        rerank_score: src.rerank_score,
      },
    });
  };

  const trace = (results?.trace ?? null) as Record<string, Record<string, unknown>[]> | null;
  const sources = (results?.sources ?? []) as Record<string, unknown>[];
  const citations = (results?.citations ?? []) as Record<string, unknown>[];

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card/40">
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            <div>
              <h1 className="text-sm font-semibold tracking-tight">Document Intelligence</h1>
              <p className="text-[10px] text-muted-foreground">Hybrid RAG · Qdrant · BM25</p>
            </div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          <Button
            variant={activeTab === "documents" ? "secondary" : "ghost"}
            className="justify-start gap-2"
            onClick={() => setActiveTab("documents")}
          >
            <Database className="size-4" />
            Documents
          </Button>
          <Button
            variant={activeTab === "query" ? "secondary" : "ghost"}
            className="justify-start gap-2"
            onClick={() => setActiveTab("query")}
          >
            <Search className="size-4" />
            Retrieval &amp; chat
          </Button>
          <Button
            variant={activeTab === "metrics" ? "secondary" : "ghost"}
            className="justify-start gap-2"
            onClick={() => setActiveTab("metrics")}
          >
            <Activity className="size-4" />
            Metrics
          </Button>
        </nav>
        <div className="space-y-3 border-t border-border p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Settings className="mr-1 inline size-3" />
            Retrieval
          </p>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span>Reranker</span>
            <Switch
              checked={settings.reranker_enabled}
              onCheckedChange={(c) => setSettings((s) => ({ ...s, reranker_enabled: c }))}
            />
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Top K</span>
              <span className="tabular-nums text-muted-foreground">{settings.top_k}</span>
            </div>
            <Slider
              value={[settings.top_k]}
              min={1}
              max={20}
              step={1}
              onValueChange={(v) =>
                setSettings((s) => ({
                  ...s,
                  top_k: Array.isArray(v) ? v[0] : v,
                }))
              }
            />
          </div>
          <div className="space-y-1 text-xs">
            <span className="text-muted-foreground">Mode</span>
            <Input
              value={settings.retrieval_mode}
              onChange={(e) =>
                setSettings((s) => ({ ...s, retrieval_mode: e.target.value }))
              }
              placeholder="hybrid | dense | bm25"
              className="h-8 text-xs"
            />
          </div>
        </div>
        <div className="border-t border-border p-3 text-[10px] text-muted-foreground">
          API{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{API_BASE}</code>
        </div>
      </aside>

      <main className="relative min-w-0 flex-1 overflow-y-auto">
        {activeTab === "documents" && (
          <div className="mx-auto max-w-5xl space-y-8 p-8">
            <header className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Document workspace</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Upload PDFs for live parsing, chunking, embedding, BM25 indexing, and Qdrant
                vector storage. Every stage is tracked so you can trust what the system did with
                your file.
              </p>
            </header>

            <Card
              className="border-dashed"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={onDrop}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UploadCloud className="size-4 text-primary" />
                  Upload PDFs
                </CardTitle>
                <CardDescription>
                  Drag and drop files here, or choose from disk. Upload progress and ingestion
                  stages stream below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    id="pdf-file-input"
                    multiple
                    disabled={uploadBusy}
                    onChange={(e) => {
                      if (e.target.files) void handleFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    disabled={uploadBusy}
                    onClick={() => document.getElementById("pdf-file-input")?.click()}
                  >
                    Choose PDFs
                  </Button>
                  {uploadBusy && (
                    <span className="text-xs text-muted-foreground">Processing…</span>
                  )}
                </div>
                {(uploadBusy || uploadPct > 0) && (
                  <Progress value={uploadPct}>
                    <div className="flex w-full items-center gap-2">
                      <ProgressLabel>Upload</ProgressLabel>
                      <ProgressValue />
                    </div>
                    <ProgressTrack>
                      <ProgressIndicator />
                    </ProgressTrack>
                  </Progress>
                )}

                {activeJob && (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">Ingestion pipeline</span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {activeJob.status}
                      </Badge>
                    </div>
                    <ol className="space-y-2">
                      {activeJob.stages.map((st) => (
                        <li
                          key={st.key}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="text-muted-foreground">{st.label}</span>
                          <span
                            className={
                              st.status === "completed"
                                ? "text-emerald-500"
                                : st.status === "running"
                                  ? "text-amber-500"
                                  : "text-muted-foreground"
                            }
                          >
                            {st.status === "completed"
                              ? "Done"
                              : st.status === "running"
                                ? "Running…"
                                : "Pending"}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Indexed documents</CardTitle>
                  <CardDescription>
                    Live view of the corpus available to hybrid retrieval.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => void refreshDocuments()}>
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="space-y-0">
                {docsLoading ? (
                  <div className="space-y-2 py-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : documents.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No documents yet. Upload a PDF to populate the workspace.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">File</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                          <th className="py-2 pr-3 font-medium">Pages</th>
                          <th className="py-2 pr-3 font-medium">Chunks</th>
                          <th className="py-2 pr-3 font-medium">Ingest (ms)</th>
                          <th className="py-2 font-medium">Embedding model</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map((d) => (
                          <tr key={d.document_id} className="border-b border-border/60">
                            <td className="max-w-[200px] truncate py-2 pr-3 font-medium">
                              {d.filename}
                            </td>
                            <td className="py-2 pr-3">
                              <Badge
                                variant="outline"
                                className={
                                  d.status === "ready"
                                    ? "border-emerald-500/40 text-emerald-600"
                                    : d.status === "failed"
                                      ? "border-destructive/40 text-destructive"
                                      : ""
                                }
                              >
                                {d.status}
                              </Badge>
                            </td>
                            <td className="py-2 pr-3 tabular-nums">{d.page_count || "—"}</td>
                            <td className="py-2 pr-3 tabular-nums">{d.chunk_count || "—"}</td>
                            <td className="py-2 pr-3 tabular-nums">
                              {d.ingestion_duration_ms ?? "—"}
                            </td>
                            <td className="py-2 text-[10px] text-muted-foreground">
                              {d.embedding_model}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "query" && (
          <div className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-12">
            <section className="space-y-4 lg:col-span-7">
              <header>
                <h2 className="text-xl font-semibold tracking-tight">Retrieval &amp; answer</h2>
                <p className="text-sm text-muted-foreground">
                  Ask questions across all indexed PDFs. Inspect dense vs sparse signals, fusion,
                  reranking, and final citations.
                </p>
              </header>
              <Textarea
                placeholder="Ask a precise question about your documents…"
                className="min-h-[120px] resize-y text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void runQuery();
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <Button onClick={() => void runQuery()} disabled={queryLoading || !query.trim()}>
                  {queryLoading ? "Running pipeline…" : "Run retrieval"}
                </Button>
              </div>

              <AnimatePresence>
                {results && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Sparkles className="size-4 text-amber-500" />
                          Generated answer
                        </CardTitle>
                        <CardDescription>
                          Grounded on the reranked chunks shown in the trace and sources panels.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <article className="prose prose-invert max-w-none text-sm leading-relaxed text-foreground">
                          <p className="whitespace-pre-wrap">
                            {String((results as { answer?: string }).answer ?? "")}
                          </p>
                        </article>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            <section className="space-y-4 lg:col-span-5">
              {results && (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <BookOpen className="size-4 text-sky-500" />
                        Citations
                      </CardTitle>
                      <CardDescription>
                        Source PDF, chunk id, page, and retrieval scores for each cited passage.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="max-h-[280px] overflow-auto text-xs">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border text-[10px] uppercase text-muted-foreground">
                            <th className="py-1.5 pr-2 text-left">#</th>
                            <th className="py-1.5 pr-2 text-left">PDF</th>
                            <th className="py-1.5 pr-2 text-left">Page</th>
                            <th className="py-1.5 pr-2 text-left">Sim.</th>
                            <th className="py-1.5 pr-2 text-left">RRF</th>
                            <th className="py-1.5 text-left">Rerank</th>
                          </tr>
                        </thead>
                        <tbody>
                          {citations.map((c) => (
                            <tr
                              key={String(c.index)}
                              className="cursor-pointer border-b border-border/50 hover:bg-muted/40"
                              onClick={() => {
                                const src = sources[(c.index as number) - 1];
                                if (src) openPreviewFromSource(src as Record<string, unknown>);
                              }}
                            >
                              <td className="py-1.5 pr-2 tabular-nums">{String(c.index)}</td>
                              <td className="max-w-[120px] truncate py-1.5 pr-2">
                                {String(c.filename ?? c.source_pdf ?? "—")}
                              </td>
                              <td className="py-1.5 pr-2 tabular-nums">{displayPage(c.page)}</td>
                              <td className="py-1.5 pr-2 font-mono text-[10px]">
                                {fmtNum(c.retrieval_score)}
                              </td>
                              <td className="py-1.5 pr-2 font-mono text-[10px]">
                                {fmtNum(c.rrf_score)}
                              </td>
                              <td className="py-1.5 font-mono text-[10px]">
                                {fmtNum(c.rerank_score)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        Click a row to open the PDF preview on the cited page.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="size-4 text-emerald-500" />
                        Final sources ({sources.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-[320px] space-y-2 overflow-auto">
                      {sources.map((src, idx) => (
                        <button
                          type="button"
                          key={String(src.chunk_id ?? idx)}
                          onClick={() => openPreviewFromSource(src)}
                          className="w-full rounded-lg border border-border bg-card/40 p-3 text-left text-xs transition hover:border-primary/50 hover:bg-muted/30"
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              Chunk {idx + 1}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {String(src.filename ?? "source")}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Page {displayPage(src.page)}
                            </span>
                            <ChevronRight className="ml-auto size-3 text-muted-foreground" />
                          </div>
                          <p className="line-clamp-4 text-muted-foreground">{String(src.text)}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                            <span>sim {fmtNum(src.score)}</span>
                            <span>rrf {fmtNum(src.rrf_score)}</span>
                            <span>rerank {fmtNum(src.rerank_score)}</span>
                          </div>
                        </button>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Activity className="size-4 text-violet-500" />
                        Retrieval trace
                      </CardTitle>
                      <CardDescription>
                        Dense vectors, BM25, reciprocal rank fusion, and cross-encoder reranking.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="dense">
                        <TabsList className="mb-2 flex h-auto w-full flex-wrap gap-1">
                          {["dense", "bm25", "fusion", "reranked"].map((k) => (
                            <TabsTrigger key={k} value={k} className="text-[10px] capitalize">
                              {k}{" "}
                              <Badge variant="outline" className="ml-1 text-[9px]">
                                {(trace?.[k] ?? []).length}
                              </Badge>
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        {["dense", "bm25", "fusion", "reranked"].map((k) => (
                          <TabsContent key={k} value={k} className="max-h-56 overflow-auto rounded-md border border-border bg-muted/20 p-2">
                            <ol className="space-y-2 text-[11px]">
                              {(trace?.[k] ?? []).map((item, i) => (
                                <li key={i} className="rounded border border-border/60 bg-background/60 p-2">
                                  <div className="mb-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                                    <span>#{i + 1}</span>
                                    <span>sim {fmtNum(item.score)}</span>
                                    <span>rrf {fmtNum(item.rrf_score)}</span>
                                    <span>rerank {fmtNum(item.rerank_score)}</span>
                                  </div>
                                  <p className="line-clamp-3 text-foreground/90">{String(item.text)}</p>
                                </li>
                              ))}
                            </ol>
                          </TabsContent>
                        ))}
                      </Tabs>
                    </CardContent>
                  </Card>
                </>
              )}
              {!results && (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Run a query to see citations, chunk-level scores, and the full retrieval trace.
                  </CardContent>
                </Card>
              )}
            </section>
          </div>
        )}

        {activeTab === "metrics" && (
          <div className="mx-auto max-w-3xl space-y-6 p-8">
            <h2 className="text-xl font-semibold">Evaluation metrics</h2>
            <p className="text-sm text-muted-foreground">
              Placeholder dashboard values from <code className="rounded bg-muted px-1">/api/metrics</code>.
              Wire this to your offline eval pipeline when ready.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Precision</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-semibold text-sky-500">85%</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Recall</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-semibold text-emerald-500">78%</CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent
          showCloseButton
          className="max-h-[92vh] max-w-5xl overflow-y-auto sm:max-w-5xl"
        >
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
                  {preview.filename}
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {preview.chunkId ?? "chunk"}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Page {displayPage(preview.page0)} · Similarity {fmtNum(preview.scores.retrieval_score)} ·
                  RRF {fmtNum(preview.scores.rrf_score)} · Rerank {fmtNum(preview.scores.rerank_score)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <PdfViewerPane
                    fileUrl={documentPdfUrl(preview.documentId)}
                    pageNumber={(preview.page0 ?? 0) + 1}
                  />
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Text-layer highlight for arbitrary chunks requires stored coordinates; this
                    preview jumps to the originating page and shows the chunk passage beside it.
                  </p>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Referenced passage
                  </p>
                  <div className="max-h-[52vh] overflow-auto rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-foreground">
                    {preview.chunkText}
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-[10px] text-muted-foreground">
                    <div className="font-mono text-[10px] text-foreground">
                      chunk_id: {preview.chunkId ?? "—"}
                    </div>
                    <div>document_id: {preview.documentId}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
