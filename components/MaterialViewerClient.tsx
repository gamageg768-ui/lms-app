'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Material, MCQSet, SECTIONS, LearningPath, PaperSubmission } from '@/types';
import { formatFileSize } from '@/lib/utils';

const PDFViewer = dynamic(() => import('./PDFViewer'), { ssr: false });
const VideoPlayer = dynamic(() => import('./VideoPlayer'), { ssr: false });
const MaterialComments = dynamic(() => import('./MaterialComments'), { ssr: false });
const SubmissionUploadModal = dynamic(() => import('./SubmissionUploadModal'), { ssr: false });
import MCQPanel from './MCQPanel';

interface SecurityConfig {
  pdfWatermark: boolean;
  pdfPointerOverlay: boolean;
  concurrentSessionGuard: boolean;
}

interface Props {
  materials: Material[];
  mcqSets: any[];
  subject: string;
  section: string;
  sectionLabel: string;
  userEmail: string;
  subjectLabel: string;
  backHref: string;
  learningPaths?: LearningPath[];
  securityConfig?: SecurityConfig;
}

const hasMCQ = (section: string) => ['PAST_PAPERS', 'MODEL_PAPERS'].includes(section);

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string }> = {
  BEGINNER:     { label: 'Beginner',     color: 'bg-green-100 text-green-700' },
  INTERMEDIATE: { label: 'Intermediate', color: 'bg-yellow-100 text-yellow-700' },
  ADVANCED:     { label: 'Advanced',     color: 'bg-red-100 text-red-700' },
};

export default function MaterialViewerClient({
  materials, mcqSets, section, sectionLabel,
  userEmail, subjectLabel, backHref, learningPaths = [], securityConfig,
}: Props) {
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest');
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());

  // Feature 3: Difficulty filter
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');

  // Feature 6: Study queue
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [showQueue, setShowQueue] = useState(false);

  // View mode toggle (paper / marking scheme / video)
  const [viewMode, setViewMode] = useState<'paper' | 'marking' | 'video'>('paper');

  // Feature 7: Bookmarking
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [bookmarkFilter, setBookmarkFilter] = useState<'all' | 'starred'>('all');

  // Feature 8: Saved reading progress per material
  const [savedPages, setSavedPages] = useState<Record<string, number>>({});

  const showMCQ = hasMCQ(section) && mcqSets.length > 0;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`lms-viewed-${section}`);
      if (raw) setViewedIds(new Set(JSON.parse(raw)));
    } catch {}
  }, [section]);

  // Feature 7: Load bookmarks from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('lms-bookmarks');
      if (raw) setBookmarked(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  // Feature 8: Load saved pages from localStorage
  useEffect(() => {
    const pages: Record<string, number> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('lms-pdf-progress-')) {
          const id = key.replace('lms-pdf-progress-', '');
          const val = localStorage.getItem(key);
          if (val) {
            const { page } = JSON.parse(val);
            if (page > 1) pages[id] = page;
          }
        }
      }
    } catch {}
    setSavedPages(pages);
  }, [selectedMaterial]); // refresh when material changes (user may have navigated)

  // Feature 7: Save bookmarks when they change
  useEffect(() => {
    try {
      localStorage.setItem('lms-bookmarks', JSON.stringify(Array.from(bookmarked)));
    } catch {}
  }, [bookmarked]);

  // Feature 6: Load/save study queue from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('lms-study-queue');
      if (raw) setQueueIds(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('lms-study-queue', JSON.stringify(queueIds)); } catch {}
  }, [queueIds]);

  const addToQueue = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQueueIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const removeFromQueue = (id: string) => setQueueIds(prev => prev.filter(x => x !== id));

  const queueMaterials = useMemo(() =>
    queueIds.map(id => materials.find(m => m.id === id)).filter(Boolean) as Material[],
    [queueIds, materials]
  );

  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const sortedMaterials = useMemo(() => {
    const copy = [...materials];
    if (sortMode === 'oldest') return copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (sortMode === 'az')     return copy.sort((a, b) => a.title.localeCompare(b.title));
    if (sortMode === 'za')     return copy.sort((a, b) => b.title.localeCompare(a.title));
    return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [materials, sortMode]);

  const filteredMaterials = useMemo(() => {
    let list = sortedMaterials;
    if (bookmarkFilter === 'starred') list = list.filter(m => bookmarked.has(m.id));
    if (difficultyFilter !== 'all') list = list.filter(m => m.difficulty === difficultyFilter);
    if (searchQuery.trim()) list = list.filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()));
    return list;
  }, [sortedMaterials, searchQuery, bookmarkFilter, bookmarked, difficultyFilter]);

  // Feature 2: Learning path the selected material belongs to (first match)
  const activePath = useMemo(() => {
    if (!selectedMaterial) return null;
    return learningPaths.find(p => p.items.some(i => i.materialId === selectedMaterial.id)) ?? null;
  }, [selectedMaterial, learningPaths]);

  const activePathIndex = useMemo(() => {
    if (!activePath || !selectedMaterial) return -1;
    return activePath.items.findIndex(i => i.materialId === selectedMaterial.id);
  }, [activePath, selectedMaterial]);

  const prevPathMaterial = useMemo(() => {
    if (!activePath || activePathIndex <= 0) return null;
    const prevItem = activePath.items[activePathIndex - 1];
    return materials.find(m => m.id === prevItem.materialId) ?? null;
  }, [activePath, activePathIndex, materials]);

  const nextPathMaterial = useMemo(() => {
    if (!activePath || activePathIndex < 0 || activePathIndex >= activePath.items.length - 1) return null;
    const nextItem = activePath.items[activePathIndex + 1];
    return materials.find(m => m.id === nextItem.materialId) ?? null;
  }, [activePath, activePathIndex, materials]);

  const handleSelectMaterial = (m: Material) => {
    setSelectedMaterial(m);
    setViewMode('paper'); // reset to paper view on new material
    setMobileDrawerOpen(false);
    if (!viewedIds.has(m.id)) {
      const next = new Set(viewedIds).add(m.id);
      setViewedIds(next);
      try { localStorage.setItem(`lms-viewed-${section}`, JSON.stringify(Array.from(next))); } catch {}
    }
  };

  const sectionInfo = SECTIONS.find(s => s.key === section);
  const badgeColor = section === 'PAST_PAPERS'
    ? 'bg-blue-100 text-blue-700'
    : section === 'MODEL_PAPERS'
    ? 'bg-purple-100 text-purple-700'
    : 'bg-gray-100 text-gray-600';

  const starredCount = useMemo(() => materials.filter(m => bookmarked.has(m.id)).length, [materials, bookmarked]);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Sidebar header with back link */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <Link href={backHref} className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1 flex-shrink-0">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          {subjectLabel}
        </Link>
        <span className="text-gray-300 text-xs">/</span>
        <span className="text-xs font-semibold text-gray-700 truncate">{sectionLabel}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {/* Search */}
        <div className="relative mb-2">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search materials..."
            className="w-full text-xs pl-6 pr-6 py-1.5 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:border-blue-400"
          />
          <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
          </svg>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
          )}
        </div>

        {/* Feature 7: Bookmark filter tabs + Feature 6: queue toggle */}
        <div className="flex gap-1 mb-2">
          <button onClick={() => setBookmarkFilter('all')}
            className={`flex-1 text-xs py-1 rounded-lg transition ${bookmarkFilter === 'all' ? 'bg-blue-100 text-blue-700 font-semibold' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>All</button>
          <button onClick={() => setBookmarkFilter('starred')}
            className={`flex-1 text-xs py-1 rounded-lg transition ${bookmarkFilter === 'starred' ? 'bg-yellow-100 text-yellow-700 font-semibold' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>★ {starredCount}</button>
          {queueIds.length > 0 && (
            <button onClick={() => setShowQueue(q => !q)}
              className={`flex-1 text-xs py-1 rounded-lg transition ${showQueue ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              ⏭ {queueIds.length}
            </button>
          )}
        </div>

        {/* Feature 3: Difficulty filter */}
        {materials.some(m => m.difficulty) && (
          <div className="flex gap-1 mb-2 flex-wrap">
            {['all', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map(d => (
              <button key={d} onClick={() => setDifficultyFilter(d)}
                className={`text-xs px-2 py-0.5 rounded-full border transition ${difficultyFilter === d
                  ? 'border-blue-400 bg-blue-100 text-blue-700 font-semibold'
                  : 'border-gray-200 text-gray-500 hover:border-blue-300'}`}>
                {d === 'all' ? 'All levels' : DIFFICULTY_CONFIG[d].label}
              </button>
            ))}
          </div>
        )}

        {/* Feature 6: Study queue mini-panel */}
        {showQueue && queueMaterials.length > 0 && (
          <div className="mb-3 border border-indigo-200 rounded-xl bg-indigo-50 p-2">
            <p className="text-xs font-bold text-indigo-700 mb-1">Study Queue</p>
            <ul className="space-y-1">
              {queueMaterials.map((m, i) => (
                <li key={m.id} className="flex items-center gap-1">
                  <span className="text-xs text-indigo-400 w-4">{i + 1}.</span>
                  <button onClick={() => !m.comingSoon && handleSelectMaterial(m)}
                    className="flex-1 text-left text-xs text-indigo-800 font-medium truncate hover:underline">
                    {m.title}
                  </button>
                  <button onClick={() => removeFromQueue(m.id)} className="text-indigo-300 hover:text-red-500 text-xs">✕</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sort */}
        <select
          value={sortMode}
          onChange={e => setSortMode(e.target.value as typeof sortMode)}
          className="w-full text-xs py-1 px-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:border-blue-400 mb-3"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="az">A – Z</option>
          <option value="za">Z – A</option>
        </select>

        {/* Section label + count badge */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{sectionInfo?.icon ?? '📁'}</span>
            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">{sectionLabel}</h3>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
            {materials.length}
          </span>
        </div>

        {/* Material list */}
        {materials.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-3xl mb-2">📭</div>
            <p className="text-xs">No materials yet</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            {bookmarkFilter === 'starred' ? (
              <>
                <p className="text-xs">No starred materials</p>
                <button onClick={() => setBookmarkFilter('all')} className="text-xs text-blue-500 mt-1 hover:underline">Show all</button>
              </>
            ) : (
              <>
                <p className="text-xs">No results for "{searchQuery}"</p>
                <button onClick={() => setSearchQuery('')} className="text-xs text-blue-500 mt-1 hover:underline">Clear search</button>
              </>
            )}
          </div>
        ) : (
          <ul className="space-y-1">
            {filteredMaterials.map(m => {
              const isStarred = bookmarked.has(m.id);
              const savedPage = savedPages[m.id];
              const inQueue = queueIds.includes(m.id);
              const diffCfg = m.difficulty ? DIFFICULTY_CONFIG[m.difficulty] : null;
              return (
                <li key={m.id}>
                  {/* Feature 7: Coming-soon placeholder */}
                  {m.comingSoon ? (
                    <div className="w-full rounded-xl p-3 border-2 border-dashed border-gray-200 bg-gray-50 opacity-75">
                      <div className="flex items-start gap-2">
                        <span className="text-lg flex-shrink-0 grayscale">🔒</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-500 truncate">{m.title}</p>
                          <p className="text-xs text-amber-600 mt-0.5">
                            ⏰ Available {m.publishAt ? new Date(m.publishAt).toLocaleDateString() : 'soon'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSelectMaterial(m)}
                      className={`w-full text-left rounded-xl p-3 transition-all ${
                        selectedMaterial?.id === m.id
                          ? 'bg-blue-50 border-2 border-blue-300'
                          : 'hover:bg-gray-50 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg flex-shrink-0">📄</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-medium text-gray-800 truncate">{m.title}</p>
                            {viewedIds.has(m.id) && (
                              <span className="flex-shrink-0 inline-flex w-4 h-4 rounded-full bg-green-100 items-center justify-center">
                                <svg className="w-2.5 h-2.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                                </svg>
                              </span>
                            )}
                            {m.markingSchemeFilename && <span className="flex-shrink-0 text-xs">📋</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-xs text-gray-400">{formatFileSize(m.fileSize)}</p>
                            {savedPage && <span className="text-xs text-blue-500">↩ p.{savedPage}</span>}
                            {/* Feature 3: Difficulty badge */}
                            {diffCfg && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${diffCfg.color}`}>
                                {diffCfg.label}
                              </span>
                            )}
                          </div>
                          {m.hasDownloadPermission && (
                            <span className="inline-block text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full mt-1">
                              ↓ Download allowed
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                          <button onClick={e => toggleBookmark(m.id, e)}
                            className={`text-base leading-none transition-colors ${isStarred ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-400'}`}
                            title={isStarred ? 'Remove bookmark' : 'Bookmark'}>★</button>
                          {/* Feature 6: Queue button */}
                          <button onClick={e => addToQueue(m.id, e)}
                            className={`text-xs leading-none transition-colors ${inQueue ? 'text-indigo-500' : 'text-gray-200 hover:text-indigo-400'}`}
                            title={inQueue ? 'Remove from queue' : 'Add to study queue'}>⏭</button>
                        </div>
                      </div>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">

      {/* ── Minimal top strip (36px) ── */}
      <div className="flex-shrink-0 h-9 bg-white border-b border-gray-200 flex items-center px-2 gap-2">
        {/* Sidebar toggle (desktop) */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg hover:bg-gray-100 text-gray-500 flex-shrink-0"
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          aria-label="Toggle sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="md:hidden flex items-center justify-center w-7 h-7 rounded-lg hover:bg-gray-100 text-gray-500 flex-shrink-0"
          aria-label="Open sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs min-w-0 overflow-hidden">
          <Link href={backHref} className="text-gray-400 hover:text-gray-700 flex-shrink-0">← {subjectLabel}</Link>
          <span className="text-gray-300 flex-shrink-0">/</span>
          <span className="font-semibold text-gray-700 flex-shrink-0">{sectionLabel}</span>
          {selectedMaterial && (
            <>
              <span className="text-gray-300 flex-shrink-0">/</span>
              <span className="text-gray-500 truncate">{selectedMaterial.title}</span>
            </>
          )}
        </div>

        {/* Submit Answer Paper button — Past Papers / Model Papers only */}
        {selectedMaterial && hasMCQ(section) && (
          <button
            onClick={() => setShowSubmitModal(true)}
            className="ml-auto flex-shrink-0 flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
            title="Submit your answer paper for this exam"
          >
            {submittedIds.has(selectedMaterial.id) ? '✅ Submitted' : '📤 Submit Answer'}
          </button>
        )}

        {/* Paper / Marking Scheme / Video tab toggle */}
        {selectedMaterial && (selectedMaterial.markingSchemeFilename || selectedMaterial.videoUrl) && (
          <div className={`${hasMCQ(section) ? '' : 'ml-auto'} flex-shrink-0 flex gap-1 bg-gray-100 rounded-lg p-0.5`}>
            <button
              onClick={() => setViewMode('paper')}
              className={`text-xs px-2 py-1 rounded-md transition font-medium ${viewMode === 'paper' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >📄 Paper</button>
            {selectedMaterial.markingSchemeFilename && (
              <button
                onClick={() => setViewMode('marking')}
                className={`text-xs px-2 py-1 rounded-md transition font-medium ${viewMode === 'marking' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >📋 Marking</button>
            )}
            {selectedMaterial.videoUrl && (
              <button
                onClick={() => setViewMode('video')}
                className={`text-xs px-2 py-1 rounded-md transition font-medium ${viewMode === 'video' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >🎬 Video</button>
            )}
          </div>
        )}
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Desktop sidebar — collapses to w-0 */}
        <div className={`hidden md:flex flex-col flex-shrink-0 border-r border-gray-200 bg-white overflow-hidden transition-all duration-200 ${sidebarOpen ? 'w-64' : 'w-0'}`}>
          <SidebarContent />
        </div>

        {/* Content area */}
        {selectedMaterial ? (
          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            {/* Feature 2: Learning path navigation bar */}
            {activePath && activePathIndex >= 0 && (
              <div className="flex-shrink-0 bg-indigo-50 border-b border-indigo-100 px-3 py-1 flex items-center gap-2 text-xs">
                <span className="text-indigo-500 flex-shrink-0">📚</span>
                <span className="text-indigo-700 font-semibold truncate flex-1">{activePath.title}</span>
                <span className="text-indigo-400 flex-shrink-0 font-mono">{activePathIndex + 1}/{activePath.items.length}</span>
                {prevPathMaterial && (
                  <button
                    onClick={() => handleSelectMaterial(prevPathMaterial)}
                    className="flex-shrink-0 text-indigo-600 hover:text-indigo-800 font-medium px-2 py-0.5 rounded-lg hover:bg-indigo-100 transition"
                    title={prevPathMaterial.title}
                  >← Prev</button>
                )}
                {nextPathMaterial && (
                  <button
                    onClick={() => handleSelectMaterial(nextPathMaterial)}
                    className="flex-shrink-0 text-indigo-600 hover:text-indigo-800 font-medium px-2 py-0.5 rounded-lg hover:bg-indigo-100 transition"
                    title={nextPathMaterial.title}
                  >Next →</button>
                )}
              </div>
            )}
            <div className="flex flex-1 overflow-hidden min-w-0">
            <div className={showMCQ ? 'flex-[3] overflow-hidden min-w-0' : 'flex-1 overflow-hidden'}>
              {viewMode === 'video' && selectedMaterial.videoUrl ? (
                <VideoPlayer url={selectedMaterial.videoUrl} />
              ) : (
                <PDFViewer
                  materialId={selectedMaterial.id}
                  userEmail={userEmail}
                  hasDownloadPermission={viewMode === 'paper' ? (selectedMaterial.hasDownloadPermission ?? false) : false}
                  src={viewMode === 'marking' ? `/api/materials/${selectedMaterial.id}/marking-scheme` : undefined}
                  securityConfig={securityConfig}
                />
              )}
            </div>
            {showMCQ && (
              <div className="flex-1 overflow-hidden min-w-0">
                <MCQPanel
                  mcqSets={mcqSets}
                  materialId={selectedMaterial.id}
                  hasMarkingScheme={!!selectedMaterial.markingSchemeFilename}
                  onViewMarkingScheme={() => setViewMode('marking')}
                />
              </div>
            )}
            </div>
            {/* Q&A discussion thread */}
            {section !== 'FLASH_CARDS' && (
              <MaterialComments materialId={selectedMaterial.id} />
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center px-4">
              <div className="text-6xl mb-4">📂</div>
              <h3 className="text-lg font-semibold text-gray-700">Select a document</h3>
              <p className="text-sm text-gray-400 mt-1">
                {materials.length === 0
                  ? 'No materials uploaded yet'
                  : 'Choose a file from the list to view it'}
              </p>
              {materials.length > 0 && !sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="mt-4 text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Open sidebar
                </button>
              )}
              {/* Mobile: show button to open the materials drawer */}
              {materials.length > 0 && (
                <button
                  onClick={() => setMobileDrawerOpen(true)}
                  className="md:hidden mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
                  </svg>
                  View {materials.length} material{materials.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Submission upload modal */}
        {showSubmitModal && selectedMaterial && (
          <SubmissionUploadModal
            materialId={selectedMaterial.id}
            materialTitle={selectedMaterial.title}
            onClose={() => setShowSubmitModal(false)}
            onSubmitted={(sub: PaperSubmission) => {
              setSubmittedIds(prev => new Set(prev).add(sub.materialId));
              setShowSubmitModal(false);
            }}
          />
        )}

        {/* Mobile drawer */}
        {mobileDrawerOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl flex flex-col md:hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <span className="font-semibold text-gray-800 text-sm">{sectionLabel}</span>
                <button onClick={() => setMobileDrawerOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SidebarContent />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
