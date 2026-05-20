"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Props = {
  fileUrl: string;
  /** 1-based page index for react-pdf */
  pageNumber: number;
};

export default function PdfViewerPane({ fileUrl, pageNumber }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [pages, setPages] = useState<number | null>(null);

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.max(280, Math.floor(w - 8)));
    });
    const el = hostRef.current;
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onLoad = useCallback((info: { numPages: number }) => {
    setPages(info.numPages);
  }, []);

  const safePage = useMemo(() => {
    if (!pages) return Math.max(1, pageNumber);
    return Math.min(Math.max(1, pageNumber), pages);
  }, [pageNumber, pages]);

  return (
    <div ref={hostRef} className="w-full rounded-lg border border-border bg-muted/30">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">PDF preview</span>
        {pages != null && (
          <span>
            Page {safePage} / {pages}
          </span>
        )}
      </div>
      <div className="max-h-[62vh] overflow-auto p-2">
        <Document
          file={fileUrl}
          onLoadSuccess={onLoad}
          loading={
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading document…
            </div>
          }
          error={
            <div className="p-8 text-center text-sm text-destructive">
              Could not load PDF. Check that the API is running and CORS allows this origin.
            </div>
          }
        >
          <Page
            pageNumber={safePage}
            width={width}
            className="shadow-lg"
            renderAnnotationLayer
            renderTextLayer
          />
        </Document>
      </div>
    </div>
  );
}
