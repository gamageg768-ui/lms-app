'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import AIFlashcardGenerator from '@/components/AIFlashcardGenerator';

interface FlashCardData {
  id: string;
  subject: string;
  question: string;
  answer: string;
  order: number;
}

interface Props {
  cards: FlashCardData[];
  subjectLabel: string;
  backHref: string;
  subject: string;
}

type Rating = 'easy' | 'medium' | 'hard';
type DeckFilter = 'all' | 'new' | 'weak' | 'starred' | 'due';

interface Mastery { easy: string[]; medium: string[]; hard: string[]; }
interface SREntry { interval: number; nextDue: number; ease: number; }
interface SessionRecord { date: string; rated: number; easy: number; medium: number; hard: number; durationSecs: number; }
interface StreakData { lastDate: string; streak: number; totalDays: number; }

function emptyMastery(): Mastery { return { easy: [], medium: [], hard: [] }; }

function todayStr() { return new Date().toISOString().slice(0, 10); }

function sm2Update(entry: SREntry | undefined, rating: Rating): SREntry {
  const prev = entry ?? { interval: 0, nextDue: 0, ease: 2.5 };
  let { interval, ease } = prev;
  const q = rating === 'easy' ? 5 : rating === 'medium' ? 3 : 1;
  ease = Math.max(1.3, ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (q < 3) interval = 1;
  else if (interval === 0) interval = 1;
  else if (interval === 1) interval = 6;
  else interval = Math.round(interval * ease);
  return { interval, ease, nextDue: Date.now() + interval * 86400000 };
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60), s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const RATING_STYLE: Record<Rating, string> = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  hard: 'bg-red-100 text-red-700',
};

export default function FlashCardPage({ cards, subjectLabel, backHref, subject }: Props) {
  // ── Core state ──
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [filter, setFilter] = useState<DeckFilter>('all');
  const [aiTab, setAiTab] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);

  // F1: Spaced repetition
  const [srData, setSrData] = useState<Record<string, SREntry>>({});

  // F2: Timed drill
  const [timerSecs, setTimerSecs] = useState<5 | 10 | 15 | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // F3: Streak
  const [streak, setStreak] = useState<StreakData>({ lastDate: '', streak: 0, totalDays: 0 });
  const [dailyDone, setDailyDone] = useState(0);
  const DAILY_GOAL = 10;

  // F4: Session summary
  const [showSummary, setShowSummary] = useState(false);
  const sessionStartRef = useRef(Date.now());

  // F5: Search
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // F6: TTS
  const [ttsEnabled, setTtsEnabled] = useState(false);

  // F7: Memory notes
  const [cardNotes, setCardNotes] = useState<Record<string, string>>({});
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');

  // F8: Starred
  const [starred, setStarred] = useState<string[]>([]);

  // F9: Study heatmap
  const [heatmap, setHeatmap] = useState<Record<string, number>>({});
  const [showHeatmap, setShowHeatmap] = useState(false);

  // F10: Session history
  const [sessionHistory, setSessionHistory] = useState<SessionRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // F11: Per-card history
  const [cardHistory, setCardHistory] = useState<Record<string, Rating[]>>({});
  const [showCardHistory, setShowCardHistory] = useState<string | null>(null);

  // F12: Mastery from localStorage (existing)
  const [mastery, setMastery] = useState<Mastery>(emptyMastery());

  // F13: Print mode
  const [showPrint, setShowPrint] = useState(false);
  const [printFilter, setPrintFilter] = useState<'all' | 'hard' | 'starred'>('all');

  // ── Load all localStorage ──
  useEffect(() => {
    const load = <T,>(key: string, fallback: T): T => {
      try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
    };
    const savedMastery = load<Mastery>(`lms-flashcard-mastery-${subject}`, emptyMastery());
    // F12: Seed mastery from admin-set AI difficulty tags for cards not yet rated
    const adminDiff = load<Record<string, string>>(`lms-admin-card-difficulty-${subject}`, {});
    if (Object.keys(adminDiff).length > 0) {
      const ratedIds = new Set([...savedMastery.easy, ...savedMastery.medium, ...savedMastery.hard]);
      for (const [id, diff] of Object.entries(adminDiff)) {
        if (!ratedIds.has(id)) {
          if (diff === 'easy') savedMastery.easy = [...savedMastery.easy, id];
          else if (diff === 'hard') savedMastery.hard = [...savedMastery.hard, id];
          else savedMastery.medium = [...savedMastery.medium, id];
        }
      }
    }
    setMastery(savedMastery);
    setSrData(load(`lms-sr-${subject}`, {}));
    setStreak(load(`lms-streak-${subject}`, { lastDate: '', streak: 0, totalDays: 0 }));
    setDailyDone(load(`lms-daily-${subject}-${todayStr()}`, 0));
    setSessionHistory(load(`lms-flash-sessions-${subject}`, []));
    setCardNotes(load(`lms-card-notes-${subject}`, {}));
    setStarred(load(`lms-card-stars-${subject}`, []));
    setHeatmap(load(`lms-study-log-${subject}`, {}));
    setCardHistory(load(`lms-card-history-${subject}`, {}));
  }, [subject]);

  const saveMastery = (m: Mastery) => {
    setMastery(m);
    try { localStorage.setItem(`lms-flashcard-mastery-${subject}`, JSON.stringify(m)); } catch {}
  };

  // ── F2: Timer ──
  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setTimerActive(false);
          setFlipped(true); // auto-flip on expire
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive]);

  // ── F6: TTS on flip/card change ──
  const speakText = useCallback((text: string) => {
    if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }, [ttsEnabled]);

  // ── Filtered deck ──
  const filteredCards = useMemo(() => {
    let list = cards;
    if (filter === 'new') list = cards.filter(c => !mastery.easy.includes(c.id) && !mastery.medium.includes(c.id) && !mastery.hard.includes(c.id));
    else if (filter === 'weak') list = cards.filter(c => mastery.medium.includes(c.id) || mastery.hard.includes(c.id));
    else if (filter === 'starred') list = cards.filter(c => starred.includes(c.id));
    else if (filter === 'due') list = cards.filter(c => !srData[c.id] || srData[c.id].nextDue <= Date.now());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.question.toLowerCase().includes(q) || c.answer.toLowerCase().includes(q));
    }
    return list;
  }, [cards, filter, mastery, starred, srData, searchQuery]);

  // Reset index on filter change
  useEffect(() => { setCardIndex(0); setFlipped(false); setShowSummary(false); }, [filter]);

  const card = filteredCards[cardIndex];
  const total = filteredCards.length;

  // Counts
  const masteredCount = mastery.easy.length;
  const learningCount = mastery.medium.length + mastery.hard.length;
  const newCount = cards.length - masteredCount - learningCount;
  const dueCount = cards.filter(c => !srData[c.id] || srData[c.id].nextDue <= Date.now()).length;
  const starredCount = starred.length;

  // ── Rate card ──
  const rate = (r: Rating) => {
    if (!card) return;

    // Session ratings
    const newRatings = { ...ratings, [card.id]: r };
    setRatings(newRatings);

    // Mastery
    const updated: Mastery = {
      easy: mastery.easy.filter(id => id !== card.id),
      medium: mastery.medium.filter(id => id !== card.id),
      hard: mastery.hard.filter(id => id !== card.id),
    };
    updated[r] = [...updated[r], card.id];
    saveMastery(updated);

    // F1: SR update
    const newSR = { ...srData, [card.id]: sm2Update(srData[card.id], r) };
    setSrData(newSR);
    try { localStorage.setItem(`lms-sr-${subject}`, JSON.stringify(newSR)); } catch {}

    // F11: Card history (last 5)
    const newCardHist = { ...cardHistory, [card.id]: [...(cardHistory[card.id] ?? []), r].slice(-5) };
    setCardHistory(newCardHist);
    try { localStorage.setItem(`lms-card-history-${subject}`, JSON.stringify(newCardHist)); } catch {}

    // F3: Streak + daily goal
    const today = todayStr();
    const newDaily = dailyDone + 1;
    setDailyDone(newDaily);
    try { localStorage.setItem(`lms-daily-${subject}-${today}`, JSON.stringify(newDaily)); } catch {}
    if (streak.lastDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const newStrk = streak.lastDate === yesterday ? streak.streak + 1 : 1;
      const newSt = { lastDate: today, streak: newStrk, totalDays: streak.totalDays + 1 };
      setStreak(newSt);
      try { localStorage.setItem(`lms-streak-${subject}`, JSON.stringify(newSt)); } catch {}
    }

    // F9: Heatmap
    const today2 = todayStr();
    const newHm = { ...heatmap, [today2]: (heatmap[today2] ?? 0) + 1 };
    setHeatmap(newHm);
    try { localStorage.setItem(`lms-study-log-${subject}`, JSON.stringify(newHm)); } catch {}

    // F2: Reset timer for next card
    if (timerSecs) { setTimeLeft(timerSecs); setTimerActive(true); }

    // Auto-advance
    setFlipped(false);
    setTimeout(() => {
      const isLast = cardIndex === filteredCards.length - 1;
      if (isLast) {
        // F4: Save session + show summary
        const ratedCount = Object.keys(newRatings).length;
        const session: SessionRecord = {
          date: new Date().toISOString(),
          rated: ratedCount,
          easy: Object.values(newRatings).filter(x => x === 'easy').length,
          medium: Object.values(newRatings).filter(x => x === 'medium').length,
          hard: Object.values(newRatings).filter(x => x === 'hard').length,
          durationSecs: Math.round((Date.now() - sessionStartRef.current) / 1000),
        };
        const newHist = [session, ...sessionHistory].slice(0, 10);
        setSessionHistory(newHist);
        try { localStorage.setItem(`lms-flash-sessions-${subject}`, JSON.stringify(newHist)); } catch {}
        setShowSummary(true);
        setCardIndex(0);
      } else {
        setCardIndex(i => i + 1);
      }
    }, 260);
  };

  const handleFlip = () => {
    const next = !flipped;
    setFlipped(next);
    if (timerSecs && !flipped) { clearInterval(timerRef.current!); setTimerActive(false); }
    if (card) speakText(next ? card.answer : card.question);
  };

  const navigate = (dir: 1 | -1) => {
    if (timerSecs) { clearInterval(timerRef.current!); setTimerActive(false); }
    setCardIndex(i => (i + dir + total) % total);
    setFlipped(false);
    setShowCardHistory(null);
    setTimeout(() => { if (card) speakText(card.question); }, 50);
  };

  const startNewSession = () => {
    setShowSummary(false);
    setRatings({});
    setCardIndex(0);
    setFlipped(false);
    sessionStartRef.current = Date.now();
    if (timerSecs) { setTimeLeft(timerSecs); setTimerActive(true); }
  };

  const resetMastery = () => {
    saveMastery(emptyMastery());
    setSrData({});
    setRatings({});
    setCardIndex(0);
    setFlipped(false);
    setShowSummary(false);
    try { localStorage.removeItem(`lms-sr-${subject}`); } catch {}
  };

  // F8: Star toggle
  const toggleStar = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = starred.includes(id) ? starred.filter(x => x !== id) : [...starred, id];
    setStarred(next);
    try { localStorage.setItem(`lms-card-stars-${subject}`, JSON.stringify(next)); } catch {}
  };

  // F7: Save note
  const saveNote = (cardId: string) => {
    const next = { ...cardNotes, [cardId]: noteInput };
    if (!noteInput.trim()) { delete next[cardId]; }
    setCardNotes(next);
    try { localStorage.setItem(`lms-card-notes-${subject}`, JSON.stringify(next)); } catch {}
    setEditingNote(null);
    setNoteInput('');
  };

  // F5: Search toggle
  const toggleSearch = () => {
    setShowSearch(s => {
      if (!s) setTimeout(() => searchRef.current?.focus(), 50);
      return !s;
    });
    setSearchQuery('');
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA'].includes(tag)) return;
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); toggleSearch(); return; }
      if (showSummary || aiTab) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleFlip(); }
      if (e.key === 'ArrowLeft' || e.key === 'h') navigate(-1);
      if (e.key === 'ArrowRight' || e.key === 'l') navigate(1);
      if (flipped) {
        if (e.key === '1') rate('hard');
        if (e.key === '2') rate('medium');
        if (e.key === '3') rate('easy');
      }
      if (e.key === 's' && card) toggleStar(card.id);
      if (e.key === 'p') setShowPrint(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [flipped, card, showSummary, aiTab, handleFlip, navigate, rate, toggleStar]);

  // ── F9: Heatmap grid (last 12 weeks = 84 days) ──
  const heatmapDays = useMemo(() => {
    const days: string[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, []);
  const heatmapWeeks = useMemo(() => {
    const weeks: string[][] = [];
    for (let i = 0; i < heatmapDays.length; i += 7) weeks.push(heatmapDays.slice(i, i + 7));
    return weeks;
  }, [heatmapDays]);
  const maxHeat = useMemo(() => Math.max(...Object.values(heatmap), 1), [heatmap]);
  const heatColor = (count: number) => {
    if (!count) return 'bg-gray-100';
    const p = count / maxHeat;
    if (p < 0.25) return 'bg-green-200';
    if (p < 0.5) return 'bg-green-400';
    if (p < 0.75) return 'bg-green-500';
    return 'bg-green-700';
  };

  // ── F13: Print cards ──
  const printCards = useMemo(() => {
    if (printFilter === 'hard') return cards.filter(c => mastery.hard.includes(c.id));
    if (printFilter === 'starred') return cards.filter(c => starred.includes(c.id));
    return cards;
  }, [printFilter, cards, mastery, starred]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* F13: Print overlay */}
      {showPrint && (
        <div className="fixed inset-0 z-[200] bg-white overflow-auto p-8 print:p-0">
          <div className="flex items-center justify-between mb-6 print:hidden">
            <h2 className="font-bold text-gray-900 text-lg">🖨 Print Flash Cards — {subjectLabel}</h2>
            <div className="flex gap-2 items-center">
              <select value={printFilter} onChange={e => setPrintFilter(e.target.value as any)}
                className="text-sm border border-gray-300 rounded-xl px-3 py-1.5 focus:outline-none">
                <option value="all">All cards ({cards.length})</option>
                <option value="hard">Hard cards ({mastery.hard.length})</option>
                <option value="starred">Starred ({starredCount})</option>
              </select>
              <button onClick={() => window.print()}
                className="bg-gray-900 text-white px-4 py-1.5 rounded-xl text-sm font-semibold hover:bg-gray-700 transition">Print</button>
              <button onClick={() => setShowPrint(false)}
                className="text-gray-400 hover:text-gray-700 text-sm px-3 py-1.5 border border-gray-200 rounded-xl transition">Close</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 print:gap-2">
            {printCards.map((c, i) => (
              <div key={c.id} className="border border-gray-200 rounded-xl p-4 print:rounded-none print:border print:break-inside-avoid">
                <p className="text-xs font-bold text-gray-400 mb-1">Q{i + 1}</p>
                <p className="text-sm font-semibold text-gray-800 mb-2">{c.question}</p>
                <div className="border-t border-dashed border-gray-200 pt-2">
                  <p className="text-xs text-gray-500">{c.answer}</p>
                </div>
              </div>
            ))}
          </div>
          <style>{`@media print { .print\\:hidden { display: none; } }`}</style>
        </div>
      )}

      {/* F11: Per-card history popup */}
      {showCardHistory && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowCardHistory(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 text-sm">Card Rating History</h3>
              <button onClick={() => setShowCardHistory(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {(() => {
              const hist = cardHistory[showCardHistory] ?? [];
              const c = cards.find(c => c.id === showCardHistory);
              return (
                <>
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{c?.question}</p>
                  {hist.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">Not rated yet</p>
                  ) : (
                    <div className="flex gap-1.5 flex-wrap justify-center">
                      {hist.map((r, i) => (
                        <span key={i} className={`text-xs font-bold px-2 py-1 rounded-full ${RATING_STYLE[r]}`}>{r}</span>
                      ))}
                    </div>
                  )}
                  {srData[showCardHistory] && (
                    <p className="text-xs text-center text-gray-400 mt-3">
                      Next due: {new Date(srData[showCardHistory].nextDue).toLocaleDateString()} · Interval: {srData[showCardHistory].interval}d
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Breadcrumb + streak */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={backHref} className="text-gray-400 hover:text-gray-700 text-sm">← {subjectLabel}</Link>
          <span className="text-gray-300">/</span>
          <span className="font-semibold text-gray-800">Flash Cards</span>
        </div>
        {/* F3: Streak badge */}
        {streak.streak > 0 && (
          <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-xl px-3 py-1">
            <span className="text-base">🔥</span>
            <span className="text-sm font-bold text-orange-700">{streak.streak} day streak</span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      {cards.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {/* F5: Search */}
          <button onClick={toggleSearch}
            title="Search cards (Ctrl+F)"
            className={`text-xs px-2 py-1.5 border rounded-xl transition font-medium ${showSearch ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-blue-300'}`}>
            🔍
          </button>

          {/* F2: Timer select */}
          <select value={timerSecs ?? ''}
            onChange={e => {
              const v = e.target.value ? Number(e.target.value) as 5 | 10 | 15 : null;
              setTimerSecs(v);
              setTimerActive(false);
              setTimeLeft(v ?? 0);
            }}
            className="text-xs border border-gray-200 text-gray-600 rounded-xl px-2 py-1.5 focus:outline-none focus:border-blue-400 bg-white">
            <option value="">⏱ No timer</option>
            <option value="5">⏱ 5s drill</option>
            <option value="10">⏱ 10s drill</option>
            <option value="15">⏱ 15s drill</option>
          </select>

          {/* F6: TTS */}
          <button onClick={() => setTtsEnabled(t => !t)}
            title="Auto read-aloud (Web Speech)"
            className={`text-xs px-2 py-1.5 border rounded-xl transition font-medium ${ttsEnabled ? 'bg-green-100 border-green-400 text-green-700' : 'border-gray-200 text-gray-500 hover:border-green-300'}`}>
            🔊
          </button>

          {/* F9: Heatmap */}
          <button onClick={() => setShowHeatmap(h => !h)}
            title="Study activity calendar"
            className={`text-xs px-2 py-1.5 border rounded-xl transition font-medium ${showHeatmap ? 'bg-emerald-100 border-emerald-400 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-emerald-300'}`}>
            📅
          </button>

          {/* F10: Session history */}
          <button onClick={() => setShowHistory(h => !h)}
            title="Session history"
            disabled={sessionHistory.length === 0}
            className={`text-xs px-2 py-1.5 border rounded-xl transition font-medium disabled:opacity-40 ${showHistory ? 'bg-purple-100 border-purple-400 text-purple-700' : 'border-gray-200 text-gray-500 hover:border-purple-300'}`}>
            🕐
          </button>

          {/* F13: Print */}
          <button onClick={() => setShowPrint(true)}
            title="Print cheat sheet (P)"
            className="text-xs px-2 py-1.5 border border-gray-200 text-gray-500 rounded-xl hover:border-gray-400 transition font-medium">
            🖨
          </button>

          {/* F3: Daily goal progress */}
          <div className="ml-auto flex items-center gap-1.5">
            <div className="text-xs text-gray-500">Today: {Math.min(dailyDone, DAILY_GOAL)}/{DAILY_GOAL}</div>
            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-orange-400 rounded-full transition-all"
                style={{ width: `${Math.min((dailyDone / DAILY_GOAL) * 100, 100)}%` }} />
            </div>
            {dailyDone >= DAILY_GOAL && <span className="text-xs text-orange-500 font-bold">✓</span>}
          </div>
        </div>
      )}

      {/* F5: Search bar */}
      {showSearch && (
        <div className="mb-3 relative">
          <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search questions and answers..."
            className="w-full text-sm pl-8 pr-8 py-2 border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
          )}
          {searchQuery && (
            <p className="text-xs text-gray-400 mt-1 px-1">{filteredCards.length} result{filteredCards.length !== 1 ? 's' : ''}</p>
          )}
        </div>
      )}

      {/* F9: Calendar heatmap */}
      {showHeatmap && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
          <p className="text-xs font-bold text-gray-700 mb-2">Study Activity (last 12 weeks)</p>
          <div className="flex gap-0.5">
            {heatmapWeeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map(day => (
                  <div key={day}
                    className={`w-3 h-3 rounded-sm ${heatColor(heatmap[day] ?? 0)}`}
                    title={`${day}: ${heatmap[day] ?? 0} cards rated`} />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-400">
            <span>Less</span>
            {['bg-gray-100','bg-green-200','bg-green-400','bg-green-500','bg-green-700'].map(c => (
              <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span>More</span>
            <span className="ml-auto">Total study days: {streak.totalDays}</span>
          </div>
        </div>
      )}

      {/* F10: Session history */}
      {showHistory && sessionHistory.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
          <p className="text-xs font-bold text-gray-700 mb-2">Session History</p>
          <div className="space-y-1">
            {sessionHistory.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-gray-50 last:border-0">
                <span className="text-gray-400 w-20 flex-shrink-0">{new Date(s.date).toLocaleDateString()}</span>
                <span className="text-gray-600">{s.rated} cards</span>
                <span className="text-green-600 ml-1">✓{s.easy}</span>
                <span className="text-amber-600">~{s.medium}</span>
                <span className="text-red-500">✗{s.hard}</span>
                <span className="text-gray-400 ml-auto">{formatDuration(s.durationSecs)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mastery summary bar */}
      {(cards.length > 0 || !aiTab) && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
          {cards.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-3 text-xs flex-wrap">
                  <span className="text-green-600 font-semibold">✓ {masteredCount} mastered</span>
                  <span className="text-amber-600 font-semibold">↺ {learningCount} learning</span>
                  <span className="text-gray-400 font-semibold">○ {newCount} new</span>
                </div>
                {(masteredCount + learningCount) > 0 && (
                  <button onClick={resetMastery} className="text-xs text-gray-400 hover:text-red-500 transition">Reset</button>
                )}
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div className="h-full flex rounded-full overflow-hidden transition-all duration-500">
                  <div className="bg-green-400 transition-all" style={{ width: `${(masteredCount / cards.length) * 100}%` }} />
                  <div className="bg-amber-400 transition-all" style={{ width: `${(learningCount / cards.length) * 100}%` }} />
                </div>
              </div>
            </>
          )}

          {/* Filter tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {cards.length > 0 && (
              [
                ['all', `All (${cards.length})`],
                ['weak', `Hard/Med (${learningCount})`],
                ['new', `New (${newCount})`],
                ['starred', `⭐ (${starredCount})`],
                ['due', `Due (${dueCount})`],
              ] as [DeckFilter, string][]
            ).map(([key, label]) => (
              <button key={key} onClick={() => { setFilter(key); setAiTab(false); }}
                className={`flex-1 text-xs py-1.5 rounded-xl border font-medium transition min-w-fit px-2 ${!aiTab && filter === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                {label}
              </button>
            ))}
            <button onClick={() => setAiTab(a => !a)}
              className={`flex-1 text-xs py-1.5 rounded-xl border font-medium transition min-w-fit px-2 ${aiTab ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-600 border-purple-200 hover:border-purple-400'}`}>
              ✨ AI
            </button>
          </div>
        </div>
      )}

      {/* AI Generator tab */}
      {aiTab ? (
        <AIFlashcardGenerator subject={subject} />
      ) : cards.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-gray-200">
          <div className="text-5xl mb-3">🃏</div>
          <p className="text-gray-500 mb-4">No flash cards available yet</p>
          <button onClick={() => setAiTab(true)}
            className="bg-purple-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-purple-700 transition">
            ✨ Generate with AI
          </button>
        </div>

      ) : total === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border-2 border-gray-200">
          <div className="text-4xl mb-3">{filter === 'due' ? '🎉' : filter === 'starred' ? '⭐' : '🎉'}</div>
          <p className="font-semibold text-gray-700 mb-1">
            {filter === 'new' ? 'All cards rated!' : filter === 'due' ? 'No cards due today!' : filter === 'starred' ? 'No starred cards' : 'No cards match'}
          </p>
          <button onClick={() => setFilter('all')} className="mt-2 text-sm text-blue-600 hover:underline">Show all cards</button>
        </div>

      ) : showSummary ? (
        /* F4: Session summary */
        <div className="bg-white rounded-2xl border-2 border-green-200 p-6 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Session Complete!</h2>
          <p className="text-sm text-gray-500 mb-5">You've reviewed all {total} cards</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: '😊 Easy', val: Object.values(ratings).filter(r => r === 'easy').length, color: 'bg-green-50 text-green-700 border-green-200' },
              { label: '😐 Medium', val: Object.values(ratings).filter(r => r === 'medium').length, color: 'bg-amber-50 text-amber-700 border-amber-200' },
              { label: '😰 Hard', val: Object.values(ratings).filter(r => r === 'hard').length, color: 'bg-red-50 text-red-700 border-red-200' },
            ].map(({ label, val, color }) => (
              <div key={label} className={`rounded-xl border p-3 ${color}`}>
                <div className="text-2xl font-bold">{val}</div>
                <div className="text-xs font-medium mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          {sessionHistory[0] && (
            <p className="text-xs text-gray-400 mb-5">
              ⏱ {formatDuration(sessionHistory[0].durationSecs)} · Streak: 🔥{streak.streak} days
            </p>
          )}
          <div className="flex gap-3">
            <button onClick={startNewSession}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition text-sm">
              Study Again
            </button>
            <button onClick={() => { setFilter('weak'); setShowSummary(false); }}
              disabled={Object.values(ratings).filter(r => r === 'hard' || r === 'medium').length === 0}
              className="flex-1 border-2 border-red-200 bg-red-50 text-red-700 py-2.5 rounded-xl font-semibold hover:bg-red-100 transition text-sm disabled:opacity-40">
              Weak Cards Only
            </button>
          </div>
        </div>

      ) : card ? (
        <>
          {/* Card nav header */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-50 text-sm font-medium transition">
              ← Prev
            </button>
            <div className="text-center">
              <span className="text-sm text-gray-500">{cardIndex + 1} / {total}</span>
              {/* F2: Timer countdown */}
              {timerSecs && (
                <div className={`text-xs font-bold mt-0.5 ${timeLeft <= 3 ? 'text-red-500' : 'text-blue-500'}`}>
                  ⏱ {timeLeft}s
                </div>
              )}
            </div>
            <button onClick={() => navigate(1)}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-50 text-sm font-medium transition">
              Next →
            </button>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            {/* F2: Timer ring bar */}
            {timerSecs && timerActive && (
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-1">
                <div className={`h-full rounded-full transition-all duration-1000 ${timeLeft <= 3 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${(timeLeft / timerSecs) * 100}%` }} />
              </div>
            )}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${((cardIndex + 1) / total) * 100}%` }} />
            </div>
          </div>

          {/* Flip card */}
          <div className="w-full cursor-pointer mb-4 relative"
            style={{ height: '280px', perspective: '1000px' }}
            onClick={handleFlip}>
            {/* F8: Star button */}
            <button
              onClick={e => toggleStar(card.id, e)}
              className={`absolute top-3 right-3 z-10 text-xl leading-none transition-colors ${starred.includes(card.id) ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-400'}`}
              title="Star this card (S)">
              ★
            </button>
            {/* F11: History button */}
            <button
              onClick={e => { e.stopPropagation(); setShowCardHistory(card.id); }}
              className="absolute top-3 left-3 z-10 text-xs text-gray-300 hover:text-blue-500 transition"
              title="Card rating history">ⓘ</button>

            <div style={{
              position: 'relative', width: '100%', height: '100%',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
              transform: flipped ? 'rotateY(180deg)' : 'none',
            }}>
              {/* Front */}
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                className="bg-white border-2 border-blue-200 rounded-2xl shadow-md flex flex-col items-center justify-center p-8">
                <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">Question</div>
                <p className="text-xl font-semibold text-gray-800 text-center leading-relaxed">{card.question}</p>
                <p className="text-xs text-gray-400 mt-6">Tap to reveal • [Space]</p>
                {ratings[card.id] && (
                  <span className={`absolute top-10 right-10 text-xs px-2 py-0.5 rounded-full font-bold ${RATING_STYLE[ratings[card.id]]}`}>
                    {ratings[card.id]}
                  </span>
                )}
              </div>
              {/* Back */}
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                className="bg-blue-600 border-2 border-blue-700 rounded-2xl shadow-md flex flex-col items-center justify-center p-8">
                <div className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-4">Answer</div>
                <p className="text-xl font-semibold text-white text-center leading-relaxed">{card.answer}</p>
                <p className="text-xs text-blue-300 mt-4">[1] Hard · [2] Medium · [3] Easy</p>
              </div>
            </div>
          </div>

          {/* Rating buttons / Show Answer */}
          {flipped ? (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <button onClick={() => rate('hard')}
                className="py-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 font-semibold text-sm hover:bg-red-100 transition">
                😰 Hard
              </button>
              <button onClick={() => rate('medium')}
                className="py-3 rounded-xl border-2 border-amber-200 bg-amber-50 text-amber-700 font-semibold text-sm hover:bg-amber-100 transition">
                😐 Medium
              </button>
              <button onClick={() => rate('easy')}
                className="py-3 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 font-semibold text-sm hover:bg-green-100 transition">
                😊 Easy
              </button>
            </div>
          ) : (
            <div className="text-center mb-4">
              <button onClick={handleFlip}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition text-sm">
                👁 Show Answer
              </button>
            </div>
          )}

          {/* F1: SR next-due info */}
          {srData[card.id] && (
            <div className="text-center mb-2">
              <span className="text-xs text-gray-400">
                Next due: {new Date(srData[card.id].nextDue).toLocaleDateString()} · Interval: {srData[card.id].interval}d
              </span>
            </div>
          )}

          {/* F7: Memory note */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            {editingNote === card.id ? (
              <div>
                <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)}
                  placeholder="Add a memory hook or mnemonic..."
                  rows={3}
                  className="w-full text-xs bg-white border border-amber-300 rounded-lg px-2 py-1.5 focus:outline-none resize-none"
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveNote(card.id); }} />
                <div className="flex gap-2 mt-1.5">
                  <button onClick={() => saveNote(card.id)}
                    className="text-xs bg-amber-500 text-white px-3 py-1 rounded-lg font-semibold hover:bg-amber-600 transition">Save</button>
                  <button onClick={() => { setEditingNote(null); setNoteInput(''); }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
                </div>
              </div>
            ) : cardNotes[card.id] ? (
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-amber-800 leading-relaxed flex-1">✏ {cardNotes[card.id]}</p>
                <button onClick={() => { setEditingNote(card.id); setNoteInput(cardNotes[card.id]); }}
                  className="flex-shrink-0 text-xs text-amber-600 hover:text-amber-800 underline">Edit</button>
              </div>
            ) : (
              <button onClick={() => { setEditingNote(card.id); setNoteInput(''); }}
                className="text-xs text-amber-600 hover:text-amber-800 transition">
                ✏ Add memory note
              </button>
            )}
          </div>

          {/* Keyboard hint */}
          <p className="text-center text-xs text-gray-300 mt-3 select-none">
            [Space] flip · [←→] navigate · {flipped ? '[1/2/3] rate · ' : ''}[S] star · [P] print · [Ctrl+F] search
          </p>
        </>
      ) : null}
    </div>
  );
}
