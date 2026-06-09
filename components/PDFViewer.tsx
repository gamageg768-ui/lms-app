'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface PDFViewerProps {
  materialId: string;
  userEmail: string;
  hasDownloadPermission: boolean;
  src?: string; // overrides default serve URL (used for marking scheme view)
}

export default function PDFViewer({ materialId, userEmail, hasDownloadPermission, src }: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const container2Ref = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pageInputValue, setPageInputValue] = useState('');
  const [pageInputFocused, setPageInputFocused] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Feature 5: Dark mode
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('lms-pdf-darkmode') === '1';
  });

  // Feature 6: Two-page spread
  const [twoPage, setTwoPage] = useState(false);

  // Feature 4: Reading progress restore
  const [resumePage, setResumePage] = useState<number | null>(null);

  const renderTaskRef = useRef<any>(null);
  const renderTask2Ref = useRef<any>(null);
  const pdfDocRef = useRef<any>(null);

  const renderPage = useCallback(async (pdf: any, pageNum: number) => {
    if (!containerRef.current) return;

    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
    }

    const page = await pdf.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const containerWidth = containerRef.current.clientWidth;
    const fitScale = containerWidth / baseViewport.width;
    const viewport = page.getViewport({ scale: fitScale * scale });

    let canvas = containerRef.current.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(canvas);
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d')!;
    renderTaskRef.current = page.render({ canvasContext: ctx, viewport });
    try {
      await renderTaskRef.current.promise;
    } catch (e: any) {
      if (e?.name === 'RenderingCancelledException') return;
      throw e;
    }

    drawWatermark(ctx, viewport.width, viewport.height, userEmail);
  }, [scale, userEmail]);

  const renderPage2 = useCallback(async (pdf: any, pageNum: number) => {
    if (!container2Ref.current) return;

    if (renderTask2Ref.current) {
      try { renderTask2Ref.current.cancel(); } catch {}
    }

    const page = await pdf.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const containerWidth = container2Ref.current.clientWidth;
    const fitScale = containerWidth / baseViewport.width;
    const viewport = page.getViewport({ scale: fitScale * scale });

    let canvas = container2Ref.current.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      container2Ref.current.innerHTML = '';
      container2Ref.current.appendChild(canvas);
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d')!;
    renderTask2Ref.current = page.render({ canvasContext: ctx, viewport });
    try {
      await renderTask2Ref.current.promise;
    } catch (e: any) {
      if (e?.name === 'RenderingCancelledException') return;
      throw e;
    }

    drawWatermark(ctx, viewport.width, viewport.height, userEmail);
  }, [scale, userEmail]);

  function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, email: string) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#1d4ed8';
    ctx.font = `bold ${Math.max(14, w * 0.022)}px Arial`;

    const text = `🔒 ${email} — CONFIDENTIAL`;
    const spacing = 200;

    for (let y = -h; y < h * 2; y += spacing) {
      for (let x = -w; x < w * 2; x += spacing) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 6);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
    }

    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#1e3a8a';
    ctx.font = `bold ${Math.max(11, w * 0.015)}px Arial`;
    ctx.fillText(`Viewed by: ${email}`, 10, h - 10);
    ctx.restore();
  }

  const computeFitPageScale = useCallback(async () => {
    if (!scrollContainerRef.current || !pdfDocRef.current) return;
    const page = await pdfDocRef.current.getPage(currentPage);
    const base = page.getViewport({ scale: 1 });
    const h = scrollContainerRef.current.clientHeight;
    const w = twoPage
      ? (scrollContainerRef.current.clientWidth - 4) / 2
      : scrollContainerRef.current.clientWidth;
    const fitW = w / base.width;
    const fitH = h / base.height;
    setScale(fitH / fitW);
  }, [currentPage, twoPage]);

  // Load PDF when materialId or src changes
  useEffect(() => {
    let cancelled = false;

    const loadPDF = async () => {
      setLoading(true);
      setError('');
      setCurrentPage(1);
      setResumePage(null);
      setNumPages(0);
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

        const url = src || `/api/materials/${materialId}/serve`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load PDF');

        const arrayBuffer = await response.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        if (cancelled) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        await renderPage(pdf, 1);
        setLoading(false);

        // Feature 4: Check for saved progress (paper view only, not marking scheme)
        if (!src) {
          try {
            const savedRaw = localStorage.getItem(`lms-pdf-progress-${materialId}`);
            if (savedRaw) {
              const { page: savedPage } = JSON.parse(savedRaw);
              if (savedPage > 1 && savedPage <= pdf.numPages) {
                setResumePage(savedPage);
              }
            }
          } catch {}
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'Failed to load PDF');
          setLoading(false);
        }
      }
    };

    loadPDF();
    return () => { cancelled = true; };
  }, [materialId, src, renderPage]);

  // Re-render on page/scale/fullscreen/twoPage changes
  useEffect(() => {
    if (pdfDocRef.current && numPages > 0) {
      renderPage(pdfDocRef.current, currentPage).catch(() => {});
      if (twoPage && currentPage + 1 <= numPages) {
        renderPage2(pdfDocRef.current, currentPage + 1).catch(() => {});
      } else if (container2Ref.current) {
        container2Ref.current.innerHTML = '';
      }
    }
  }, [currentPage, scale, renderPage, renderPage2, isFullScreen, twoPage, numPages]);

  // Feature 4: Save reading progress on page change
  useEffect(() => {
    if (numPages > 0 && !src) {
      try {
        localStorage.setItem(`lms-pdf-progress-${materialId}`, JSON.stringify({ page: currentPage }));
      } catch {}
    }
  }, [currentPage, materialId, numPages, src]);

  // Feature 5: Save dark mode preference
  useEffect(() => {
    try { localStorage.setItem('lms-pdf-darkmode', darkMode ? '1' : '0'); } catch {}
  }, [darkMode]);

  // Keyboard navigation
  useEffect(() => {
    const step = twoPage ? 2 : 1;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft')  setCurrentPage(p => Math.max(1, p - step));
      if (e.key === 'ArrowRight') setCurrentPage(p => Math.min(numPages, p + step));
      if (e.key === '[')          setScale(s => Math.max(0.25, +(s - 0.1).toFixed(2)));
      if (e.key === ']')          setScale(s => Math.min(4, +(s + 0.1).toFixed(2)));
      if (e.key === 'Escape' && isFullScreen) setIsFullScreen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [numPages, isFullScreen, twoPage]);

  const handleDownload = async () => {
    if (!hasDownloadPermission) return;
    const res = await fetch(`/api/materials/${materialId}/download`);
    if (!res.ok) { alert('Download not permitted'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  const step = twoPage ? 2 : 1;

  return (
    <div className={isFullScreen ? 'fixed inset-0 z-[9999] bg-gray-900 flex flex-col' : 'flex flex-col h-full bg-gray-800'}>
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-900 px-2 py-1 gap-2 flex-shrink-0 flex-wrap">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - step))}
            disabled={currentPage <= 1}
            className="text-white hover:text-gray-200 disabled:opacity-30 px-1.5 py-0.5 rounded text-sm font-bold"
          >‹</button>
          <input
            type="text"
            value={pageInputFocused ? pageInputValue : String(currentPage)}
            onFocus={() => { setPageInputFocused(true); setPageInputValue(String(currentPage)); }}
            onBlur={() => setPageInputFocused(false)}
            onChange={e => setPageInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const n = parseInt(pageInputValue, 10);
                if (!isNaN(n) && n >= 1 && n <= numPages) setCurrentPage(n);
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-8 text-center text-white text-xs bg-gray-700 rounded border border-gray-600 focus:outline-none focus:border-blue-400 py-0.5"
            aria-label="Page number"
          />
          <span className="text-white text-xs text-gray-400">/ {numPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(numPages, p + step))}
            disabled={currentPage >= numPages}
            className="text-white hover:text-gray-200 disabled:opacity-30 px-1.5 py-0.5 rounded text-sm font-bold"
          >›</button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button onClick={() => setScale(s => Math.max(0.25, +(s - 0.2).toFixed(2)))}
            className="text-white text-sm hover:text-gray-200 px-1 w-6 text-center">−</button>
          <span className="text-white text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(4, +(s + 0.2).toFixed(2)))}
            className="text-white text-sm hover:text-gray-200 px-1 w-6 text-center">+</button>
          <button
            onClick={() => setScale(1.0)}
            className="text-white text-xs hover:text-blue-300 px-1.5 py-0.5 border border-gray-600 rounded ml-1"
            title="Fit to width"
          >⊞W</button>
          <button
            onClick={computeFitPageScale}
            className="text-white text-xs hover:text-blue-300 px-1.5 py-0.5 border border-gray-600 rounded"
            title="Fit full page"
          >⊟P</button>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1">
          {/* Feature 5: Dark mode toggle */}
          <button
            onClick={() => setDarkMode(d => !d)}
            title={darkMode ? 'Light mode' : 'Dark/Night mode'}
            className={`text-xs px-1.5 py-0.5 border rounded transition ${darkMode ? 'border-yellow-400 text-yellow-300 bg-gray-700' : 'border-gray-600 text-gray-400 hover:text-yellow-300'}`}
          >🌙</button>

          {/* Feature 6: Two-page spread toggle */}
          <button
            onClick={() => setTwoPage(t => !t)}
            title={twoPage ? 'Single page view' : 'Two-page spread'}
            className={`text-xs px-1.5 py-0.5 border rounded transition ${twoPage ? 'border-blue-400 text-blue-300 bg-gray-700' : 'border-gray-600 text-gray-400 hover:text-blue-300'}`}
          >⊟⊟</button>

          {hasDownloadPermission && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded-lg transition"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          )}
          <button
            onClick={() => setIsFullScreen(f => !f)}
            title={isFullScreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
            className="text-white hover:text-blue-300 px-1.5 py-0.5 border border-gray-600 rounded"
          >
            {isFullScreen ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0h5m-5 0v5M15 9l5-5m0 0h-5m5 0v5M9 15l-5 5m0 0h5m-5 0v-5M15 15l5 5m0 0h-5m5 0v-5" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* PDF Canvas area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto pdf-protected protected-content relative"
        style={{ cursor: 'default', ...(darkMode ? { filter: 'invert(1) hue-rotate(180deg)' } : {}) }}
      >
        {/* Feature 4: Resume banner */}
        {resumePage && (
          <div className="absolute top-0 left-0 right-0 z-10 bg-blue-600 text-white text-xs flex items-center justify-between px-3 py-1.5">
            <span>Resume from page {resumePage}?</span>
            <div className="flex gap-2">
              <button
                onClick={() => { setCurrentPage(resumePage); setResumePage(null); }}
                className="font-semibold underline hover:no-underline"
              >Resume</button>
              <button
                onClick={() => {
                  setResumePage(null);
                  try { localStorage.removeItem(`lms-pdf-progress-${materialId}`); } catch {}
                }}
                className="opacity-75 hover:opacity-100"
              >Dismiss</button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <svg className="animate-spin w-8 h-8 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading PDF...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-64 text-red-400 px-4 text-center">
            {error}
          </div>
        )}

        {/* Canvas containers — flex side-by-side in two-page mode */}
        <div
          className={twoPage ? 'flex gap-1' : ''}
          onContextMenu={e => e.preventDefault()}
        >
          <div
            ref={containerRef}
            className={twoPage ? 'flex-1 min-w-0' : ''}
          />
          {twoPage && (
            <div
              ref={container2Ref}
              className="flex-1 min-w-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
