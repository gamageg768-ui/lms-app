'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

interface SecurityConfig {
  pdfWatermark: boolean;
  pdfPointerOverlay: boolean;
  concurrentSessionGuard: boolean;
}

interface PDFViewerProps {
  materialId: string;
  userEmail: string;
  hasDownloadPermission: boolean;
  src?: string;
  securityConfig?: SecurityConfig;
}

type Rotation = 0 | 90 | 180 | 270;
interface Bookmark { page: number; label: string; createdAt: string; }
interface OutlineItem { title: string; page: number; items: OutlineItem[]; }

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, email: string, sessionId: string) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#1d4ed8';
  ctx.font = `bold ${Math.max(14, w * 0.022)}px Arial`;
  const text = `${email} • CONFIDENTIAL`;
  const spacing = 180;
  for (let y = -h; y < h * 2; y += spacing)
    for (let x = -w; x < w * 2; x += spacing) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 6);
      ctx.fillText(text, 0, 0); ctx.restore();
    }
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#1e3a8a';
  ctx.font = `bold ${Math.max(11, w * 0.015)}px Arial`;
  ctx.fillText(`${email} • ref:${sessionId}`, 10, h - 10);
  ctx.restore();
}

export default function PDFViewer({ materialId, userEmail, hasDownloadPermission, src, securityConfig }: PDFViewerProps) {
  const pdfWatermark = securityConfig?.pdfWatermark !== false;
  const pdfPointerOverlay = securityConfig?.pdfPointerOverlay !== false;
  const concurrentSessionGuard = securityConfig?.concurrentSessionGuard !== false;
  const viewSessionId = useMemo(() => {
    const arr = new Uint8Array(4);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }, []);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const container2Ref = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollModeRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const renderTask2Ref = useRef<any>(null);
  const pdfDocRef = useRef<any>(null);
  const rotationRef = useRef<Rotation>(0);
  const pageEnteredRef = useRef<number>(Date.now());
  const prevPageRef = useRef<number>(1);
  const thumbsBuilt = useRef(false);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Core state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [sessionConflict, setSessionConflict] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pageInputValue, setPageInputValue] = useState('');
  const [pageInputFocused, setPageInputFocused] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Existing features
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('lms-pdf-darkmode') === '1';
  });
  const [twoPage, setTwoPage] = useState(false);
  const [resumePage, setResumePage] = useState<number | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<{ id: string; content: string; page: number; createdAt: string }[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // F1: Page thumbnails
  const [showThumbs, setShowThumbs] = useState(false);
  const [thumbs, setThumbs] = useState<string[]>([]);

  // F2: Text search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const [buildingIndex, setBuildingIndex] = useState(false);

  // F3: Named page bookmarks
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(`lms-pdf-bookmarks-${materialId}`) ?? '[]'); } catch { return []; }
  });

  // F4: Zoom preset dropdown
  const [showZoomMenu, setShowZoomMenu] = useState(false);

  // F5: Continuous scroll mode
  const [scrollMode, setScrollMode] = useState(false);
  const [scrollPageImages, setScrollPageImages] = useState<string[]>([]);
  const [buildingScroll, setBuildingScroll] = useState(false);

  // F6: Page rotation
  const [rotation, setRotation] = useState<Rotation>(0);

  // F8: Auto-scroll
  const [autoScroll, setAutoScroll] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState<8 | 5 | 3>(5);
  const [showAutoMenu, setShowAutoMenu] = useState(false);

  // F9: Focus/spotlight mode
  const [focusMode, setFocusMode] = useState(false);
  const [focusY, setFocusY] = useState(300);

  // F10: Table of contents
  const [showOutline, setShowOutline] = useState(false);
  const [outline, setOutline] = useState<OutlineItem[]>([]);

  // F11: Reading time tracker
  const [timePerPage, setTimePerPage] = useState<Record<number, number>>({});
  const [showTimeSummary, setShowTimeSummary] = useState(false);

  // F12: Page difficulty flags
  const [pageFlags, setPageFlags] = useState<Record<number, 'important' | 'confusing'>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(`lms-pdf-flags-${materialId}`) ?? '{}'); } catch { return {}; }
  });
  const [showFlags, setShowFlags] = useState(false);

  // F13: Copy to clipboard
  const [copyToast, setCopyToast] = useState(false);

  // Rating feature
  const [ratingPromptShown, setRatingPromptShown] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [ratingHover, setRatingHover] = useState<number | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);

  // Keep rotationRef in sync (so renderPage can read it without being in deps)
  rotationRef.current = rotation;

  // ── renderPage (rotation read from ref to avoid PDF reload on rotate) ──
  const renderPage = useCallback(async (pdf: any, pageNum: number) => {
    if (!containerRef.current) return;
    if (renderTaskRef.current) { try { renderTaskRef.current.cancel(); } catch {} }
    const rot = rotationRef.current;
    const page = await pdf.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1, rotation: rot });
    const containerWidth = containerRef.current.clientWidth;
    const fitScale = containerWidth / baseViewport.width;
    const viewport = page.getViewport({ scale: fitScale * scale, rotation: rot });
    let canvas = containerRef.current.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.style.display = 'block'; canvas.style.width = '100%';
      containerRef.current.innerHTML = ''; containerRef.current.appendChild(canvas);
    }
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    renderTaskRef.current = page.render({ canvasContext: ctx, viewport });
    try { await renderTaskRef.current.promise; } catch (e: any) {
      if (e?.name === 'RenderingCancelledException') return; throw e;
    }
    if (pdfWatermark) drawWatermark(ctx, viewport.width, viewport.height, userEmail, viewSessionId);
  }, [scale, userEmail, viewSessionId, pdfWatermark]);

  const renderPage2 = useCallback(async (pdf: any, pageNum: number) => {
    if (!container2Ref.current) return;
    if (renderTask2Ref.current) { try { renderTask2Ref.current.cancel(); } catch {} }
    const rot = rotationRef.current;
    const page = await pdf.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1, rotation: rot });
    const containerWidth = container2Ref.current.clientWidth;
    const fitScale = containerWidth / baseViewport.width;
    const viewport = page.getViewport({ scale: fitScale * scale, rotation: rot });
    let canvas = container2Ref.current.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.style.display = 'block'; canvas.style.width = '100%';
      container2Ref.current.innerHTML = ''; container2Ref.current.appendChild(canvas);
    }
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    renderTask2Ref.current = page.render({ canvasContext: ctx, viewport });
    try { await renderTask2Ref.current.promise; } catch (e: any) {
      if (e?.name === 'RenderingCancelledException') return; throw e;
    }
    if (pdfWatermark) drawWatermark(ctx, viewport.width, viewport.height, userEmail, viewSessionId);
  }, [scale, userEmail, viewSessionId, pdfWatermark]);

  const computeFitPageScale = useCallback(async () => {
    if (!scrollContainerRef.current || !pdfDocRef.current) return;
    const rot = rotationRef.current;
    const page = await pdfDocRef.current.getPage(currentPage);
    const base = page.getViewport({ scale: 1, rotation: rot });
    const h = scrollContainerRef.current.clientHeight;
    const w = twoPage ? (scrollContainerRef.current.clientWidth - 4) / 2 : scrollContainerRef.current.clientWidth;
    setScale((w / base.width) * (h / base.height) / (h / base.height));
    const fitW = w / base.width; const fitH = h / base.height;
    setScale(fitH / fitW);
  }, [currentPage, twoPage]);

  // ── Load PDF ──
  useEffect(() => {
    let cancelled = false;
    const loadPDF = async () => {
      setLoading(true); setError(''); setCurrentPage(1); setResumePage(null);
      setNumPages(0); setPageTexts([]); setScrollPageImages([]);
      setOutline([]); thumbsBuilt.current = false; setThumbs([]);
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        const serveUrl = src || `/api/materials/${materialId}/serve?ref=${viewSessionId}`;
        const response = await fetch(serveUrl);
        if (response.status === 410) { setExpired(true); setLoading(false); return; }
        if (!response.ok) throw new Error('Failed to load PDF');
        const arrayBuffer = await response.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        await renderPage(pdf, 1);
        setLoading(false);

        if (!src) {
          try {
            const savedRaw = localStorage.getItem(`lms-pdf-progress-${materialId}`);
            if (savedRaw) {
              const { page: savedPage } = JSON.parse(savedRaw);
              if (savedPage > 1 && savedPage <= pdf.numPages) setResumePage(savedPage);
            }
          } catch {}
        }

        // F10: Load PDF outline/table of contents
        try {
          const rawOutline = await pdf.getOutline();
          if (rawOutline?.length) {
            const resolveItems = async (items: any[]): Promise<OutlineItem[]> => {
              const result: OutlineItem[] = [];
              for (const item of items) {
                let page = 0;
                try {
                  if (Array.isArray(item.dest)) page = await pdf.getPageIndex(item.dest[0]) + 1;
                  else if (typeof item.dest === 'string') {
                    const dest = await pdf.getDestination(item.dest);
                    if (dest) page = await pdf.getPageIndex(dest[0]) + 1;
                  }
                } catch {}
                result.push({ title: item.title ?? '', page, items: item.items?.length ? await resolveItems(item.items) : [] });
              }
              return result;
            };
            const resolved = await resolveItems(rawOutline);
            if (!cancelled) setOutline(resolved);
          }
        } catch {}

        // F2: Build text search index in background
        if (!src) {
          setBuildingIndex(true);
          try {
            const texts: string[] = [];
            for (let p = 1; p <= pdf.numPages; p++) {
              if (cancelled) break;
              const pg = await pdf.getPage(p);
              const content = await pg.getTextContent();
              texts.push(content.items.map((item: any) => item.str).join(' ').toLowerCase());
            }
            if (!cancelled) setPageTexts(texts);
          } catch {}
          if (!cancelled) setBuildingIndex(false);
        }
      } catch (e: any) {
        if (!cancelled) { setError(e.message || 'Failed to load PDF'); setLoading(false); }
      }
    };
    loadPDF();
    return () => { cancelled = true; };
  }, [materialId, src, renderPage]);

  // ── Re-render on page/scale/rotation/twoPage/fullscreen changes ──
  useEffect(() => {
    if (pdfDocRef.current && numPages > 0 && !scrollMode) {
      renderPage(pdfDocRef.current, currentPage).catch(() => {});
      if (twoPage && currentPage + 1 <= numPages)
        renderPage2(pdfDocRef.current, currentPage + 1).catch(() => {});
      else if (container2Ref.current) container2Ref.current.innerHTML = '';
    }
  }, [currentPage, scale, rotation, renderPage, renderPage2, isFullScreen, twoPage, numPages, scrollMode]);

  // ── F11: Track time per page ──
  useEffect(() => {
    const prev = prevPageRef.current;
    const delta = (Date.now() - pageEnteredRef.current) / 1000;
    if (delta > 0.5) setTimePerPage(t => ({ ...t, [prev]: (t[prev] ?? 0) + delta }));
    pageEnteredRef.current = Date.now();
    prevPageRef.current = currentPage;
  }, [currentPage]);

  // ── Persistence effects ──
  useEffect(() => {
    if (numPages > 0 && !src)
      try { localStorage.setItem(`lms-pdf-progress-${materialId}`, JSON.stringify({ page: currentPage })); } catch {}
  }, [currentPage, materialId, numPages, src]);

  useEffect(() => {
    try { localStorage.setItem('lms-pdf-darkmode', darkMode ? '1' : '0'); } catch {}
  }, [darkMode]);

  useEffect(() => {
    try { localStorage.setItem(`lms-pdf-flags-${materialId}`, JSON.stringify(pageFlags)); } catch {}
  }, [pageFlags, materialId]);

  useEffect(() => {
    try { localStorage.setItem(`lms-pdf-bookmarks-${materialId}`, JSON.stringify(bookmarks)); } catch {}
  }, [bookmarks, materialId]);

  // ── F6: Clear scroll/thumb caches on rotation change ──
  useEffect(() => {
    setScrollPageImages([]);
    thumbsBuilt.current = false;
    setThumbs([]);
  }, [rotation]);

  // ── Heartbeat ──
  useEffect(() => {
    if (!concurrentSessionGuard || src || !materialId || !numPages) return;
    const sendHeartbeat = async () => {
      try {
        const res = await fetch(`/api/materials/${materialId}/heartbeat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionKey: viewSessionId }),
        });
        if (res.ok) { const data = await res.json(); if (data.conflict) setSessionConflict(true); }
      } catch {}
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30_000);
    return () => clearInterval(interval);
  }, [materialId, src, numPages, viewSessionId, concurrentSessionGuard]);

  // ── Rating: fetch on load + 30s prompt timer ──
  useEffect(() => {
    if (src || !materialId) return;
    fetch(`/api/materials/${materialId}/rating`)
      .then(r => r.json())
      .then(d => { setAvgRating(d.avg); setUserRating(d.userRating); })
      .catch(() => {});
    const t = setTimeout(() => setRatingPromptShown(true), 30_000);
    return () => clearTimeout(t);
  }, [materialId, src]);

  const handleRate = async (stars: number) => {
    setRatingLoading(true);
    try {
      const res = await fetch(`/api/materials/${materialId}/rating`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: stars }),
      });
      const d = await res.json();
      setUserRating(d.userRating); setAvgRating(d.avg);
    } finally { setRatingLoading(false); }
  };

  // ── F8: Auto-scroll ──
  useEffect(() => {
    if (!autoScroll || !numPages) return;
    autoRef.current = setInterval(() => {
      setCurrentPage(p => { if (p >= numPages) { setAutoScroll(false); return p; } return p + 1; });
    }, autoSpeed * 1000);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [autoScroll, autoSpeed, numPages]);

  // ── F1: Build thumbnails (lazy, once per material/rotation) ──
  useEffect(() => {
    if (!showThumbs || thumbsBuilt.current || !pdfDocRef.current || numPages === 0) return;
    thumbsBuilt.current = true;
    const build = async () => {
      const pdf = pdfDocRef.current; const rot = rotationRef.current;
      const result: string[] = [];
      for (let p = 1; p <= numPages; p++) {
        const page = await pdf.getPage(p);
        const vp = page.getViewport({ scale: 0.2, rotation: rot });
        const off = document.createElement('canvas');
        off.width = vp.width; off.height = vp.height;
        const ctx = off.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        result.push(off.toDataURL());
      }
      setThumbs(result);
    };
    build().catch(() => { thumbsBuilt.current = false; });
  }, [showThumbs, numPages, rotation]);

  // ── F5: Build scroll mode images ──
  useEffect(() => {
    if (!scrollMode || !pdfDocRef.current || numPages === 0) return;
    if (scrollPageImages.length === numPages) return;
    setBuildingScroll(true);
    const build = async () => {
      const pdf = pdfDocRef.current; const rot = rotationRef.current;
      const containerWidth = scrollContainerRef.current?.clientWidth ?? 800;
      const images: string[] = [];
      for (let p = 1; p <= numPages; p++) {
        const page = await pdf.getPage(p);
        const baseVp = page.getViewport({ scale: 1, rotation: rot });
        const fitScale = containerWidth / baseVp.width;
        const vp = page.getViewport({ scale: fitScale, rotation: rot });
        const off = document.createElement('canvas');
        off.width = vp.width; off.height = vp.height;
        const ctx = off.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (pdfWatermark) drawWatermark(ctx, vp.width, vp.height, userEmail, viewSessionId);
        images.push(off.toDataURL());
      }
      setScrollPageImages(images);
      setBuildingScroll(false);
    };
    build().catch(() => setBuildingScroll(false));
  }, [scrollMode, numPages, rotation, userEmail, viewSessionId]);

  // ── F5: IntersectionObserver for scroll mode ──
  useEffect(() => {
    if (!scrollMode || !scrollModeRef.current || scrollPageImages.length === 0) return;
    const divs = scrollModeRef.current.querySelectorAll('[data-page]');
    const observer = new IntersectionObserver((entries) => {
      let maxRatio = 0; let bestPage: number | null = null;
      for (const e of entries) {
        if (e.intersectionRatio > maxRatio) {
          maxRatio = e.intersectionRatio;
          bestPage = parseInt((e.target as HTMLElement).dataset.page!, 10);
        }
      }
      if (bestPage !== null && maxRatio > 0.1) setCurrentPage(bestPage);
    }, { threshold: [0, 0.25, 0.5, 0.75, 1.0] });
    divs.forEach(d => observer.observe(d));
    return () => observer.disconnect();
  }, [scrollMode, scrollPageImages.length]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const step = twoPage ? 2 : 1;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft')  setCurrentPage(p => Math.max(1, p - step));
      if (e.key === 'ArrowRight') setCurrentPage(p => Math.min(numPages, p + step));
      if (e.key === 'Home')       setCurrentPage(1);
      if (e.key === 'End')        setCurrentPage(numPages);
      if (e.key === '[') setScale(s => Math.max(0.25, +(s - 0.1).toFixed(2)));
      if (e.key === ']') setScale(s => Math.min(4, +(s + 0.1).toFixed(2)));
      if (e.key === 'Escape') {
        if (isFullScreen) setIsFullScreen(false);
        if (showSearch) { setShowSearch(false); setSearchQuery(''); setSearchMatches([]); }
        if (focusMode) setFocusMode(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowSearch(s => !s); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [numPages, isFullScreen, twoPage, showSearch, focusMode]);

  // ── F2: Search ──
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchMatches([]); return; }
    const lower = q.toLowerCase();
    const matches = pageTexts.map((t, i) => t.includes(lower) ? i + 1 : null).filter((p): p is number => p !== null);
    setSearchMatches(matches); setSearchMatchIdx(0);
    if (matches.length > 0) setCurrentPage(matches[0]);
  };

  const handleDownload = async () => {
    if (!hasDownloadPermission) return;
    const res = await fetch(`/api/materials/${materialId}/download`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.code === 'LIMIT_REACHED') alert('Download limit reached. Contact your administrator.');
      else alert('Download not permitted');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'document.pdf'; a.click();
    URL.revokeObjectURL(url);
  };

  const step = twoPage ? 2 : 1;

  const loadNotes = useCallback(async () => {
    if (src) return;
    setNotesLoading(true);
    try { const res = await fetch(`/api/materials/${materialId}/notes`); if (res.ok) setNotes(await res.json()); } catch {}
    setNotesLoading(false);
  }, [materialId, src]);

  useEffect(() => { if (showNotes) loadNotes(); }, [showNotes, loadNotes]);

  const handleAddNote = async () => {
    if (!noteInput.trim() || src) return;
    setAddingNote(true);
    const res = await fetch(`/api/materials/${materialId}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: noteInput.trim(), page: currentPage }),
    });
    if (res.ok) { const note = await res.json(); setNotes(prev => [...prev, note]); setNoteInput(''); }
    setAddingNote(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    const res = await fetch(`/api/materials/${materialId}/notes/${noteId}`, { method: 'DELETE' });
    if (res.ok) setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  // F3: Bookmarks
  const handleAddBookmark = () => {
    const label = prompt(`Bookmark label for page ${currentPage}:`) ?? '';
    const bm: Bookmark = { page: currentPage, label: label.trim() || `Page ${currentPage}`, createdAt: new Date().toISOString() };
    setBookmarks(prev => [...prev.filter(b => b.page !== currentPage), bm].sort((a, b) => a.page - b.page));
  };

  // F12: Page flags
  const handleToggleFlag = (flag: 'important' | 'confusing') => {
    setPageFlags(prev => {
      if (prev[currentPage] === flag) { const { [currentPage]: _, ...rest } = prev; return rest; }
      return { ...prev, [currentPage]: flag };
    });
  };

  // F13: Copy page to clipboard
  const handleCopyPage = () => {
    const canvas = containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } catch {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `page-${currentPage}.png`; a.click();
        URL.revokeObjectURL(url);
      }
      setCopyToast(true); setTimeout(() => setCopyToast(false), 2000);
    }, 'image/png');
  };

  // Computed
  const totalReadingTime = Object.values(timePerPage).reduce((a, b) => a + b, 0);
  const avgTimePerPage = Object.keys(timePerPage).length > 0 ? totalReadingTime / Object.keys(timePerPage).length : 0;
  const importantPages = Object.entries(pageFlags).filter(([, v]) => v === 'important').map(([k]) => +k).sort((a, b) => a - b);
  const confusingPages = Object.entries(pageFlags).filter(([, v]) => v === 'confusing').map(([k]) => +k).sort((a, b) => a - b);

  if (expired) {
    return (
      <div className="flex flex-col h-full bg-gray-800 items-center justify-center">
        <div className="bg-gray-100 rounded-2xl p-10 text-center max-w-md mx-4">
          <div className="text-4xl mb-4">⏰</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Material No Longer Available</h2>
          <p className="text-gray-500 text-sm">This material has expired and is no longer accessible. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={isFullScreen ? 'fixed inset-0 z-[9999] bg-gray-900 flex flex-col' : 'flex flex-col h-full bg-gray-800'}>

      {/* F7: Reading progress bar */}
      {numPages > 0 && (
        <div className="h-0.5 bg-gray-700 flex-shrink-0">
          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(currentPage / numPages) * 100}%` }} />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-900 px-2 py-1 gap-1 flex-shrink-0 flex-wrap">

        {/* Left: thumbnails, outline, search */}
        <div className="flex items-center gap-1">
          <button onClick={() => { setShowThumbs(t => !t); if (!showThumbs) setShowOutline(false); }}
            title="Page thumbnails" className={`text-xs px-1.5 py-0.5 border rounded transition ${showThumbs ? 'border-blue-400 text-blue-300 bg-gray-700' : 'border-gray-600 text-gray-400 hover:text-blue-300'}`}>🗂</button>
          <button onClick={() => { setShowOutline(o => !o); if (!showOutline) setShowThumbs(false); }}
            title="Table of contents" className={`text-xs px-1.5 py-0.5 border rounded transition ${showOutline ? 'border-blue-400 text-blue-300 bg-gray-700' : 'border-gray-600 text-gray-400 hover:text-blue-300'}`}>📑</button>
          <button onClick={() => setShowSearch(s => !s)} title="Find in PDF (Ctrl+F)"
            className={`text-xs px-1.5 py-0.5 border rounded transition ${showSearch ? 'border-yellow-400 text-yellow-300 bg-gray-700' : 'border-gray-600 text-gray-400 hover:text-yellow-300'}`}>🔍</button>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - step))} disabled={currentPage <= 1}
            className="text-white hover:text-gray-200 disabled:opacity-30 px-1.5 py-0.5 rounded text-sm font-bold">‹</button>
          <input type="text"
            value={pageInputFocused ? pageInputValue : String(currentPage)}
            onFocus={() => { setPageInputFocused(true); setPageInputValue(String(currentPage)); }}
            onBlur={() => setPageInputFocused(false)}
            onChange={e => setPageInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { const n = parseInt(pageInputValue, 10); if (!isNaN(n) && n >= 1 && n <= numPages) setCurrentPage(n); (e.target as HTMLInputElement).blur(); } }}
            className="w-8 text-center text-white text-xs bg-gray-700 rounded border border-gray-600 focus:outline-none focus:border-blue-400 py-0.5"
          />
          <span className="text-xs text-gray-400">/ {numPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(numPages, p + step))} disabled={currentPage >= numPages}
            className="text-white hover:text-gray-200 disabled:opacity-30 px-1.5 py-0.5 rounded text-sm font-bold">›</button>
        </div>

        {/* Zoom + F4 preset dropdown */}
        <div className="flex items-center gap-1 relative">
          <button onClick={() => setScale(s => Math.max(0.25, +(s - 0.2).toFixed(2)))} className="text-white text-sm hover:text-gray-200 px-1 w-6 text-center">−</button>
          <button onClick={() => setShowZoomMenu(z => !z)} title="Zoom presets" className="text-white text-xs w-10 text-center hover:text-blue-300">{Math.round(scale * 100)}%</button>
          <button onClick={() => setScale(s => Math.min(4, +(s + 0.2).toFixed(2)))} className="text-white text-sm hover:text-gray-200 px-1 w-6 text-center">+</button>
          <button onClick={() => setScale(1.0)} title="Fit to width" className="text-white text-xs hover:text-blue-300 px-1.5 py-0.5 border border-gray-600 rounded">⊞W</button>
          <button onClick={computeFitPageScale} title="Fit full page" className="text-white text-xs hover:text-blue-300 px-1.5 py-0.5 border border-gray-600 rounded">⊟P</button>
          {showZoomMenu && (
            <div className="absolute top-7 left-6 z-30 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[80px]" onMouseLeave={() => setShowZoomMenu(false)}>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map(p => (
                <button key={p} onClick={() => { setScale(p); setShowZoomMenu(false); }}
                  className={`block w-full text-left px-3 py-1 text-xs hover:bg-gray-700 ${Math.round(scale * 100) === Math.round(p * 100) ? 'text-blue-300' : 'text-gray-300'}`}>
                  {Math.round(p * 100)}%
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* F6: Rotation */}
          <button onClick={() => setRotation(r => ((r + 90) % 360) as Rotation)} title="Rotate 90°"
            className="text-xs px-1.5 py-0.5 border border-gray-600 text-gray-400 hover:text-white rounded">↻</button>

          {/* F5: Scroll mode */}
          <button onClick={() => setScrollMode(s => !s)} title={scrollMode ? 'Single page' : 'Continuous scroll'}
            className={`text-xs px-1.5 py-0.5 border rounded transition ${scrollMode ? 'border-blue-400 text-blue-300 bg-gray-700' : 'border-gray-600 text-gray-400 hover:text-blue-300'}`}>≡</button>

          {/* Dark mode */}
          <button onClick={() => setDarkMode(d => !d)} title={darkMode ? 'Light mode' : 'Dark mode'}
            className={`text-xs px-1.5 py-0.5 border rounded transition ${darkMode ? 'border-yellow-400 text-yellow-300 bg-gray-700' : 'border-gray-600 text-gray-400 hover:text-yellow-300'}`}>🌙</button>

          {/* Two-page spread */}
          {!scrollMode && (
            <button onClick={() => setTwoPage(t => !t)} title="Two-page spread"
              className={`text-xs px-1.5 py-0.5 border rounded transition ${twoPage ? 'border-blue-400 text-blue-300 bg-gray-700' : 'border-gray-600 text-gray-400 hover:text-blue-300'}`}>⊟⊟</button>
          )}

          {/* F9: Focus mode */}
          <button onClick={() => setFocusMode(f => !f)} title="Focus/spotlight mode"
            className={`text-xs px-1.5 py-0.5 border rounded transition ${focusMode ? 'border-purple-400 text-purple-300 bg-gray-700' : 'border-gray-600 text-gray-400 hover:text-purple-300'}`}>🔦</button>

          {/* F8: Auto-scroll */}
          <div className="relative">
            <button onClick={() => autoScroll ? setAutoScroll(false) : setShowAutoMenu(a => !a)}
              title={autoScroll ? 'Pause auto-scroll' : 'Auto-scroll'}
              className={`text-xs px-1.5 py-0.5 border rounded transition ${autoScroll ? 'border-green-400 text-green-300 bg-gray-700' : 'border-gray-600 text-gray-400 hover:text-green-300'}`}>
              {autoScroll ? '⏸' : '▶'}
            </button>
            {showAutoMenu && (
              <div className="absolute top-7 right-0 z-30 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[110px]" onMouseLeave={() => setShowAutoMenu(false)}>
                {(['Slow', 'Medium', 'Fast'] as const).map((label, i) => {
                  const speed = [8, 5, 3][i] as 8 | 5 | 3;
                  return (
                    <button key={speed} onClick={() => { setAutoSpeed(speed); setAutoScroll(true); setShowAutoMenu(false); }}
                      className={`block w-full text-left px-3 py-1 text-xs hover:bg-gray-700 ${autoSpeed === speed ? 'text-green-300' : 'text-gray-300'}`}>
                      {label} ({speed}s/pg)
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* F3: Bookmarks */}
          <button onClick={() => { setShowBookmarks(b => !b); setShowNotes(false); setShowFlags(false); setShowTimeSummary(false); }}
            title="Page bookmarks"
            className={`text-xs px-1.5 py-0.5 border rounded transition ${showBookmarks ? 'border-amber-400 text-amber-300 bg-gray-700' : 'border-gray-600 text-gray-400 hover:text-amber-300'}`}>🔖</button>

          {/* F12: Page flags */}
          <button onClick={() => { setShowFlags(f => !f); setShowNotes(false); setShowBookmarks(false); setShowTimeSummary(false); }}
            title="Page flags"
            className={`text-xs px-1.5 py-0.5 border rounded transition ${showFlags ? 'border-red-400 text-red-300 bg-gray-700' : 'border-gray-600 text-gray-400 hover:text-red-300'}`}>🚩</button>

          {/* F11: Reading time summary */}
          {totalReadingTime > 10 && (
            <button onClick={() => { setShowTimeSummary(t => !t); setShowNotes(false); setShowBookmarks(false); setShowFlags(false); }}
              title="Reading time"
              className={`text-xs px-1.5 py-0.5 border rounded transition ${showTimeSummary ? 'border-cyan-400 text-cyan-300 bg-gray-700' : 'border-gray-600 text-gray-400 hover:text-cyan-300'}`}>📊</button>
          )}

          {/* Notes */}
          {!src && (
            <button onClick={() => { setShowNotes(n => !n); setShowBookmarks(false); setShowFlags(false); setShowTimeSummary(false); }}
              title="Student notes"
              className={`text-xs px-1.5 py-0.5 border rounded transition ${showNotes ? 'border-green-400 text-green-300 bg-gray-700' : 'border-gray-600 text-gray-400 hover:text-green-300'}`}>📝</button>
          )}

          {/* F13: Copy page */}
          <button onClick={handleCopyPage} title="Copy page to clipboard"
            className="text-xs px-1.5 py-0.5 border border-gray-600 text-gray-400 hover:text-white rounded">
            {copyToast ? <span className="text-green-400">✓</span> : '📋'}
          </button>

          {/* Rating star picker */}
          {!src && ratingPromptShown && (
            <div className="flex items-center gap-0.5 border border-gray-600 rounded px-1.5 py-0.5">
              {[1,2,3,4,5].map(s => (
                <button key={s}
                  onMouseEnter={() => setRatingHover(s)}
                  onMouseLeave={() => setRatingHover(null)}
                  onClick={() => !ratingLoading && handleRate(s)}
                  className="text-sm leading-none transition"
                  title={`Rate ${s} star${s>1?'s':''}`}>
                  <span className={(ratingHover ?? userRating ?? 0) >= s ? 'text-yellow-400' : 'text-gray-600'}>★</span>
                </button>
              ))}
              {avgRating && <span className="text-xs text-gray-400 ml-1">{avgRating}</span>}
            </div>
          )}

          {/* Download */}
          {hasDownloadPermission && (
            <button onClick={handleDownload} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded-lg transition">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          )}

          {/* Fullscreen */}
          <button onClick={() => setIsFullScreen(f => !f)} title={isFullScreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
            className="text-white hover:text-blue-300 px-1.5 py-0.5 border border-gray-600 rounded">
            {isFullScreen
              ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0h5m-5 0v5M15 9l5-5m0 0h-5m5 0v5M9 15l-5 5m0 0h5m-5 0v-5M15 15l5 5m0 0h-5m5 0v-5" /></svg>
              : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            }
          </button>
        </div>
      </div>

      {/* F2: Search bar */}
      {showSearch && (
        <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 border-b border-gray-700 flex-shrink-0">
          <input type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)} autoFocus
            placeholder={buildingIndex ? 'Building index...' : 'Search text in PDF...'}
            disabled={buildingIndex}
            className="flex-1 text-xs bg-gray-700 text-white border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-yellow-400"
          />
          {searchMatches.length > 0 ? (
            <>
              <span className="text-xs text-yellow-300 flex-shrink-0">{searchMatchIdx + 1}/{searchMatches.length}</span>
              <button onClick={() => { const i = (searchMatchIdx - 1 + searchMatches.length) % searchMatches.length; setSearchMatchIdx(i); setCurrentPage(searchMatches[i]); }}
                className="text-xs text-gray-300 hover:text-white px-1.5 py-0.5 border border-gray-600 rounded">‹</button>
              <button onClick={() => { const i = (searchMatchIdx + 1) % searchMatches.length; setSearchMatchIdx(i); setCurrentPage(searchMatches[i]); }}
                className="text-xs text-gray-300 hover:text-white px-1.5 py-0.5 border border-gray-600 rounded">›</button>
            </>
          ) : searchQuery ? <span className="text-xs text-gray-500 flex-shrink-0">No matches</span> : null}
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchMatches([]); }}
            className="text-gray-400 hover:text-white text-xs flex-shrink-0">✕</button>
        </div>
      )}

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden min-w-0">

        {/* F1/F10: Left panel */}
        {(showThumbs || showOutline) && (
          <div className="w-44 flex-shrink-0 border-r border-gray-700 bg-gray-900 overflow-y-auto">
            {showThumbs && (
              <>
                <p className="text-xs font-bold text-gray-400 px-2 py-2 border-b border-gray-700 sticky top-0 bg-gray-900">Pages ({numPages})</p>
                {thumbs.length === 0
                  ? <p className="text-xs text-gray-500 p-3 text-center">Generating thumbnails...</p>
                  : <div className="p-2 space-y-2">
                      {thumbs.map((url, i) => (
                        <button key={i} onClick={() => setCurrentPage(i + 1)}
                          className={`w-full block rounded overflow-hidden border-2 transition ${currentPage === i + 1 ? 'border-blue-500' : 'border-transparent hover:border-gray-500'}`}>
                          <img src={url} alt={`Page ${i + 1}`} className="w-full" draggable={false} />
                          <div className="text-center text-gray-400 text-[10px] py-0.5">{i + 1}</div>
                        </button>
                      ))}
                    </div>
                }
              </>
            )}
            {showOutline && (
              <>
                <p className="text-xs font-bold text-gray-400 px-2 py-2 border-b border-gray-700 sticky top-0 bg-gray-900">Contents</p>
                {outline.length === 0
                  ? <p className="text-xs text-gray-500 p-3 text-center">No table of contents found in this PDF</p>
                  : <OutlineList items={outline} onJump={setCurrentPage} currentPage={currentPage} depth={0} />
                }
              </>
            )}
          </div>
        )}

        {/* Main PDF scroll container */}
        <div ref={scrollContainerRef}
          className={`flex-1 overflow-auto protected-content relative${pdfPointerOverlay ? ' pdf-protected' : ''}`}
          style={{ cursor: 'default', ...(darkMode ? { filter: 'invert(1) hue-rotate(180deg)' } : {}) }}
          onMouseMove={focusMode ? e => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setFocusY(e.clientY - rect.top); } : undefined}
          onClick={autoScroll ? () => setAutoScroll(false) : undefined}
        >
          {/* Session conflict overlay */}
          {sessionConflict && (
            <div className="absolute inset-0 z-20 bg-gray-900/90 flex flex-col items-center justify-center text-center px-6">
              <div className="text-4xl mb-4">⚠</div>
              <h3 className="text-white text-lg font-bold mb-2">Another Session is Active</h3>
              <p className="text-gray-300 text-sm mb-5">This material is being viewed from another device or tab. Close other sessions to continue.</p>
              <button onClick={() => setSessionConflict(false)} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition text-sm">Continue Anyway</button>
            </div>
          )}

          {/* F9: Focus/spotlight overlays */}
          {focusMode && !sessionConflict && (
            <>
              <div className="absolute left-0 right-0 z-10 bg-black/55 pointer-events-none" style={{ top: 0, height: Math.max(0, focusY - 70) }} />
              <div className="absolute left-0 right-0 z-10 bg-black/55 pointer-events-none" style={{ top: Math.max(0, focusY - 70) + 140, bottom: 0 }} />
            </>
          )}

          {/* Resume banner */}
          {resumePage && (
            <div className="absolute top-0 left-0 right-0 z-10 bg-blue-600 text-white text-xs flex items-center justify-between px-3 py-1.5">
              <span>Resume from page {resumePage}?</span>
              <div className="flex gap-2">
                <button onClick={() => { setCurrentPage(resumePage); setResumePage(null); }} className="font-semibold underline hover:no-underline">Resume</button>
                <button onClick={() => { setResumePage(null); try { localStorage.removeItem(`lms-pdf-progress-${materialId}`); } catch {} }} className="opacity-75 hover:opacity-100">Dismiss</button>
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
          {error && <div className="flex items-center justify-center h-64 text-red-400 px-4 text-center">{error}</div>}

          {/* F5: Scroll mode */}
          {scrollMode ? (
            <div ref={scrollModeRef}>
              {buildingScroll
                ? <div className="flex items-center justify-center h-64 text-gray-400 gap-2">
                    <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Rendering all {numPages} pages...
                  </div>
                : <div className="space-y-1 p-1">
                    {scrollPageImages.map((url, i) => (
                      <div key={i} data-page={i + 1} className="relative">
                        <span className="absolute top-1 left-1 z-10 bg-gray-900/70 text-gray-400 text-[10px] px-1.5 py-0.5 rounded">{i + 1}</span>
                        <img src={url} alt={`Page ${i + 1}`} className="w-full block" draggable={false} onContextMenu={e => e.preventDefault()} />
                      </div>
                    ))}
                  </div>
              }
            </div>
          ) : (
            <div className={twoPage ? 'flex gap-1' : ''} onContextMenu={e => e.preventDefault()}>
              <div ref={containerRef} className={twoPage ? 'flex-1 min-w-0' : ''} />
              {twoPage && <div ref={container2Ref} className="flex-1 min-w-0" />}
            </div>
          )}

          {/* F12: Page flag buttons (below canvas) */}
          {!loading && !scrollMode && numPages > 0 && (
            <div className="flex items-center justify-center gap-2 py-2">
              <button onClick={() => handleToggleFlag('important')}
                className={`text-xs px-2 py-1 rounded border transition ${pageFlags[currentPage] === 'important' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300' : 'border-gray-600 text-gray-500 hover:text-yellow-300 hover:border-yellow-600'}`}>
                ⭐ {pageFlags[currentPage] === 'important' ? 'Important ✓' : 'Mark Important'}
              </button>
              <button onClick={() => handleToggleFlag('confusing')}
                className={`text-xs px-2 py-1 rounded border transition ${pageFlags[currentPage] === 'confusing' ? 'bg-red-500/20 border-red-500 text-red-300' : 'border-gray-600 text-gray-500 hover:text-red-300 hover:border-red-600'}`}>
                🔴 {pageFlags[currentPage] === 'confusing' ? 'Confusing ✓' : 'Mark Confusing'}
              </button>
            </div>
          )}
        </div>

        {/* Right panels */}
        {(showNotes || showBookmarks || showFlags || showTimeSummary) && (
          <div className="w-64 flex-shrink-0 border-l border-gray-700 bg-gray-900 flex flex-col overflow-hidden">

            {/* Notes panel */}
            {showNotes && <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
                <p className="text-xs font-bold text-green-400">📝 My Notes</p>
                {notesLoading && <span className="text-xs text-gray-400">Loading...</span>}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {notes.length === 0 && !notesLoading && <p className="text-xs text-gray-500 text-center mt-4">No notes yet.</p>}
                {notes.map(note => (
                  <div key={note.id} className="bg-gray-800 rounded-lg p-2 group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-blue-400 font-mono">p.{note.page}</span>
                      <button onClick={() => handleDeleteNote(note.id)} className="text-gray-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition">✕</button>
                    </div>
                    <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>
              <div className="flex-shrink-0 border-t border-gray-700 p-2">
                <p className="text-xs text-gray-500 mb-1">Note for page {currentPage}</p>
                <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleAddNote(); }}
                  placeholder="Add a note... (Ctrl+Enter)" rows={3}
                  className="w-full text-xs bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-green-500 resize-none" />
                <button onClick={handleAddNote} disabled={addingNote || !noteInput.trim()}
                  className="w-full mt-1 bg-green-700 hover:bg-green-600 text-white text-xs font-semibold py-1.5 rounded-lg transition disabled:opacity-50">
                  {addingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </>}

            {/* F3: Bookmarks panel */}
            {showBookmarks && <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
                <p className="text-xs font-bold text-amber-400">🔖 Bookmarks</p>
                <button onClick={handleAddBookmark} className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded transition">+ Add</button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {bookmarks.length === 0
                  ? <p className="text-xs text-gray-500 text-center mt-4">No bookmarks yet.<br/>Click "+ Add" to bookmark page {currentPage}.</p>
                  : bookmarks.map(bm => (
                      <div key={bm.page} className="flex items-center gap-2 group hover:bg-gray-800 rounded px-2 py-1.5">
                        <button onClick={() => setCurrentPage(bm.page)} className="flex-1 text-left min-w-0">
                          <p className="text-xs text-gray-200 truncate">{bm.label}</p>
                          <p className="text-[10px] text-gray-500">Page {bm.page}</p>
                        </button>
                        <button onClick={() => setBookmarks(prev => prev.filter(b => b.page !== bm.page))}
                          className="text-gray-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition flex-shrink-0">✕</button>
                      </div>
                    ))
                }
              </div>
            </>}

            {/* F12: Flags panel */}
            {showFlags && <>
              <div className="px-3 py-2 border-b border-gray-700">
                <p className="text-xs font-bold text-red-400">🚩 Flagged Pages</p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {importantPages.length === 0 && confusingPages.length === 0
                  ? <p className="text-xs text-gray-500 text-center mt-4">No pages flagged yet.<br/>Use ⭐/🔴 buttons below the page.</p>
                  : <>
                      {importantPages.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider mb-1.5">⭐ Important</p>
                          <div className="flex flex-wrap gap-1">
                            {importantPages.map(p => (
                              <button key={p} onClick={() => setCurrentPage(p)} className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded hover:bg-yellow-500/30 transition">p.{p}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {confusingPages.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1.5">🔴 Confusing</p>
                          <div className="flex flex-wrap gap-1">
                            {confusingPages.map(p => (
                              <button key={p} onClick={() => setCurrentPage(p)} className="text-xs px-2 py-0.5 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 transition">p.{p}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                }
              </div>
            </>}

            {/* F11: Reading time panel */}
            {showTimeSummary && <>
              <div className="px-3 py-2 border-b border-gray-700">
                <p className="text-xs font-bold text-cyan-400">📊 Reading Time</p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-800 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-white">{Math.floor(totalReadingTime / 60)}m {Math.floor(totalReadingTime % 60)}s</p>
                    <p className="text-[10px] text-gray-400">Total</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-cyan-300">{Math.round(avgTimePerPage)}s</p>
                    <p className="text-[10px] text-gray-400">Avg/page</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Per page</p>
                  <div className="space-y-1">
                    {(() => {
                      const maxSecs = Math.max(...Object.values(timePerPage), 1);
                      return Object.entries(timePerPage)
                        .sort(([a], [b]) => +a - +b)
                        .map(([page, secs]) => (
                          <div key={page} className="flex items-center gap-2">
                            <button onClick={() => setCurrentPage(+page)} className="text-[10px] text-gray-400 w-5 text-right flex-shrink-0 hover:text-white">{page}</button>
                            <div className="flex-1 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full ${secs >= maxSecs ? 'bg-amber-400' : 'bg-cyan-600'}`} style={{ width: `${(secs / maxSecs) * 100}%` }} />
                            </div>
                            <span className="text-[10px] text-gray-400 w-7 flex-shrink-0">{Math.round(secs)}s</span>
                          </div>
                        ));
                    })()}
                  </div>
                </div>
              </div>
            </>}

          </div>
        )}
      </div>

      {/* Monitoring notice */}
      <div className="flex-shrink-0 bg-amber-950 border-t border-amber-800 text-amber-300 text-[10px] px-3 py-1 text-center select-none">
        ⚠ Your activity on this platform is monitored and recorded. Unauthorised sharing of content is strictly prohibited.
      </div>
    </div>
  );
}

// F10: Recursive outline component
function OutlineList({ items, onJump, currentPage, depth }: { items: OutlineItem[]; onJump: (p: number) => void; currentPage: number; depth: number }) {
  return (
    <div>
      {items.map((item, i) => (
        <div key={i}>
          <button onClick={() => item.page > 0 && onJump(item.page)}
            style={{ paddingLeft: `${8 + depth * 12}px` }}
            className={`w-full text-left text-xs py-1 pr-2 hover:bg-gray-800 transition flex items-center gap-1 ${currentPage === item.page ? 'text-blue-300' : 'text-gray-300'}`}>
            <span className="truncate">{item.title}</span>
            {item.page > 0 && <span className="flex-shrink-0 text-gray-500 text-[10px] ml-auto">{item.page}</span>}
          </button>
          {item.items.length > 0 && <OutlineList items={item.items} onJump={onJump} currentPage={currentPage} depth={depth + 1} />}
        </div>
      ))}
    </div>
  );
}
