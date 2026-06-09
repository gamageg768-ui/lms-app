'use client';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { MCQSet, MCQQuestion } from '@/types';

interface Props {
  mcqSets: MCQSet[];
  materialId: string | null;
  hasMarkingScheme?: boolean;
  onViewMarkingScheme?: () => void;
}

interface Attempt {
  date: string;
  score: number;
  total: number;
  timeTaken: number;
}

type AnswerMap = Record<string, string>;
type ReviewFilter = 'all' | 'correct' | 'wrong' | 'skipped';

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function MCQPanel({ mcqSets, materialId, hasMarkingScheme, onViewMarkingScheme }: Props) {
  const initialSet = useMemo(() => {
    if (materialId) return mcqSets.find(s => s.materialId === materialId) ?? mcqSets[0] ?? null;
    return mcqSets[0] ?? null;
  }, [mcqSets, materialId]);

  const [activeSet, setActiveSet] = useState<MCQSet | null>(initialSet);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState(false);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');

  // Feature 2: Instant feedback
  const [instantFeedback, setInstantFeedback] = useState(false);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());

  // Feature 1: Explanation expansion
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Feature 11: Help modal
  const [showHelp, setShowHelp] = useState(false);

  const [shuffleOn, setShuffleOn] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);

  const [timerSecs, setTimerSecs] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [history, setHistory] = useState<Attempt[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [focusedQ, setFocusedQ] = useState(0);

  const baseQuestions = useMemo<MCQQuestion[]>(() => {
    if (!activeSet) return [];
    const qs = activeSet.questions;
    const limit = activeSet.questionCount > 0 ? activeSet.questionCount : qs.length;
    return qs.slice(0, limit);
  }, [activeSet]);

  const questions = useMemo<MCQQuestion[]>(() => {
    if (!shuffleOn || shuffleSeed === 0) return baseQuestions;
    return seededShuffle(baseQuestions, shuffleSeed);
  }, [baseQuestions, shuffleOn, shuffleSeed]);

  const questionIndex = useMemo(() => {
    const m = new Map<string, number>();
    questions.forEach((q, i) => m.set(q.id, i));
    return m;
  }, [questions]);

  const optionCount = activeSet?.optionCount ?? 4;
  const opts = useMemo(() => ['A', 'B', 'C', 'D', ...(optionCount >= 5 ? ['E'] : [])], [optionCount]);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  const correctCount = useMemo(() => {
    if (!submitted) return 0;
    return questions.filter(q => answers[q.id] === q.answer).length;
  }, [submitted, questions, answers]);

  const wrongCount = useMemo(() => {
    if (!submitted) return 0;
    return questions.filter(q => !!answers[q.id] && answers[q.id] !== q.answer).length;
  }, [submitted, questions, answers]);

  const skippedCount = useMemo(() => {
    if (!submitted) return 0;
    return questions.filter(q => !answers[q.id]).length;
  }, [submitted, questions, answers]);

  const pct = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
  const unansweredCount = questions.length - answeredCount;

  const displayedQuestions = useMemo(() => {
    if (!submitted) return questions;
    if (reviewFilter === 'correct') return questions.filter(q => answers[q.id] === q.answer);
    if (reviewFilter === 'wrong') return questions.filter(q => !!answers[q.id] && answers[q.id] !== q.answer);
    if (reviewFilter === 'skipped') return questions.filter(q => !answers[q.id]);
    return questions;
  }, [submitted, questions, answers, reviewFilter]);

  useEffect(() => {
    if (!activeSet) return;
    try {
      const raw = localStorage.getItem(`lms-mcq-history-${activeSet.id}`);
      setHistory(raw ? JSON.parse(raw) : []);
    } catch { setHistory([]); }
  }, [activeSet?.id]);

  useEffect(() => {
    if (!timerRunning) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setTimerExpired(true);
          return 0;
        }
        setElapsed(e => e + 1);
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const saveAndSubmit = useCallback((
    currentAnswers: AnswerMap,
    currentQuestions: MCQQuestion[],
    currentElapsed: number,
    setId: string
  ) => {
    const score = currentQuestions.filter(q => currentAnswers[q.id] === q.answer).length;
    const attempt: Attempt = { date: new Date().toISOString(), score, total: currentQuestions.length, timeTaken: currentElapsed };
    try {
      const raw = localStorage.getItem(`lms-mcq-history-${setId}`);
      const prev: Attempt[] = raw ? JSON.parse(raw) : [];
      const next = [attempt, ...prev].slice(0, 5);
      localStorage.setItem(`lms-mcq-history-${setId}`, JSON.stringify(next));
      setHistory(next);
    } catch {}
    setTimerRunning(false);
    setSubmitted(true);
  }, []);

  useEffect(() => {
    if (!timerExpired) return;
    setTimerExpired(false);
    if (!submitted && activeSet) {
      saveAndSubmit(answers, questions, elapsed, activeSet.id);
    }
  }, [timerExpired, submitted, activeSet, answers, questions, elapsed, saveAndSubmit]);

  const handleSelect = useCallback((qId: string, opt: string) => {
    if (submitted) return;
    if (instantFeedback && lockedIds.has(qId)) return;
    setAnswers(prev => ({ ...prev, [qId]: opt }));
    if (instantFeedback) {
      setLockedIds(prev => { const n = new Set(prev); n.add(qId); return n; });
    }
    if (!timerRunning && timerSecs !== null) {
      setTimeLeft(timerSecs * questions.length);
      setTimerRunning(true);
    }
  }, [submitted, instantFeedback, lockedIds, timerRunning, timerSecs, questions.length]);

  const handleSubmit = useCallback(() => {
    if (submitted || !activeSet) return;
    if (timerRef.current) clearInterval(timerRef.current);
    saveAndSubmit(answers, questions, elapsed, activeSet.id);
  }, [submitted, activeSet, answers, questions, elapsed, saveAndSubmit]);

  const handleReset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setAnswers({});
    setSubmitted(false);
    setFlagged(new Set());
    setLockedIds(new Set());
    setExpandedId(null);
    setTimerRunning(false);
    setTimeLeft(0);
    setElapsed(0);
    setFocusedQ(0);
    setReviewFilter('all');
    if (shuffleOn) setShuffleSeed(Date.now());
  }, [shuffleOn]);

  const switchSet = useCallback((id: string) => {
    const s = mcqSets.find(x => x.id === id) ?? null;
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveSet(s);
    setAnswers({});
    setSubmitted(false);
    setFlagged(new Set());
    setLockedIds(new Set());
    setExpandedId(null);
    setTimerRunning(false);
    setTimeLeft(0);
    setElapsed(0);
    setFocusedQ(0);
    setReviewFilter('all');
  }, [mcqSets]);

  const toggleFlag = useCallback((id: string) => {
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?') { setShowHelp(h => !h); return; }
      if (e.key === 'Escape') { setShowHelp(false); return; }
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (submitted) {
        if (e.key === 'r') handleReset();
        return;
      }
      const q = questions[focusedQ];
      if (!q) return;
      const map: Record<string, string> = { a: 'A', '1': 'A', b: 'B', '2': 'B', c: 'C', '3': 'C', d: 'D', '4': 'D' };
      if (optionCount >= 5) { map.e = 'E'; map['5'] = 'E'; }
      if (map[e.key]) handleSelect(q.id, map[e.key]);
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); setFocusedQ(n => Math.min(questions.length - 1, n + 1)); }
      if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); setFocusedQ(n => Math.max(0, n - 1)); }
      if (e.key === 'f') toggleFlag(q.id);
      if (e.key === 's') handleSubmit();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [submitted, questions, focusedQ, optionCount, handleSelect, toggleFlag, handleSubmit, handleReset]);

  if (!activeSet || questions.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-gray-50 border-l border-gray-200">
        <div className="text-4xl mb-3">📝</div>
        <p className="text-sm text-gray-500 text-center">No MCQ questions available for this paper</p>
      </div>
    );
  }

  const reviewTabs: { key: ReviewFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: questions.length },
    { key: 'correct', label: '✓', count: correctCount },
    { key: 'wrong', label: '✗', count: wrongCount },
    { key: 'skipped', label: '⬜', count: skippedCount },
  ];

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200 select-none">
      {/* ── Header ── */}
      <div className="flex-shrink-0 bg-blue-50 border-b border-blue-100 px-2 py-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <h3 className="font-bold text-blue-900 text-xs truncate flex-1">{activeSet.title}</h3>
          {timerRunning && (
            <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${timeLeft <= 10 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
              {formatTime(timeLeft)}
            </span>
          )}
        </div>

        {mcqSets.length > 1 && (
          <select value={activeSet.id} onChange={e => switchSet(e.target.value)}
            className="w-full text-xs rounded-lg border border-blue-200 bg-white px-2 py-1 focus:outline-none">
            {mcqSets.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}

        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-blue-600 font-medium flex-shrink-0">{questions.length}Q</span>

          <select
            value={timerSecs ?? ''}
            onChange={e => {
              if (timerRef.current) clearInterval(timerRef.current);
              setTimerRunning(false);
              setTimeLeft(0);
              setTimerSecs(e.target.value ? +e.target.value : null);
            }}
            disabled={timerRunning || submitted}
            className="text-xs bg-white border border-blue-200 text-blue-700 rounded px-1 py-0.5 focus:outline-none disabled:opacity-50"
          >
            <option value="">⏱</option>
            <option value="30">30s/q</option>
            <option value="60">60s/q</option>
            <option value="90">90s/q</option>
          </select>

          <button
            onClick={() => { setShuffleOn(o => !o); if (!shuffleOn) setShuffleSeed(Date.now()); }}
            title="Shuffle questions"
            className={`text-xs px-1.5 py-0.5 rounded border transition flex-shrink-0 ${shuffleOn ? 'bg-blue-200 border-blue-400 text-blue-800' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-50'}`}
          >🔀</button>

          {/* Feature 2: Instant feedback toggle */}
          <button
            onClick={() => { setInstantFeedback(o => !o); setLockedIds(new Set()); }}
            title="Instant feedback mode (show correct/wrong immediately)"
            className={`text-xs px-1.5 py-0.5 rounded border transition flex-shrink-0 ${instantFeedback ? 'bg-green-200 border-green-400 text-green-800' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-50'}`}
          >💡</button>

          <button
            onClick={() => setShowHistory(h => !h)}
            disabled={history.length === 0}
            title="Past attempts"
            className={`text-xs px-1.5 py-0.5 rounded border transition flex-shrink-0 disabled:opacity-30 ${showHistory ? 'bg-blue-200 border-blue-400 text-blue-800' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-50'}`}
          >🕐</button>

          <div className="ml-auto flex-shrink-0">
            {!submitted ? (
              <button onClick={handleSubmit}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg transition text-white ${unansweredCount > 0 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {unansweredCount > 0 ? `Sub(${unansweredCount}⬜)` : 'Submit'}
              </button>
            ) : (
              <button onClick={handleReset}
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-600 hover:bg-gray-700 text-white transition">
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feature 3: History panel with sparkline */}
      {showHistory && history.length > 0 && (
        <div className="flex-shrink-0 mx-2 mt-1.5 rounded-xl border border-blue-100 bg-blue-50 p-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-blue-700">Past Attempts</p>
            {history.length >= 2 && (
              <svg width="60" height="20" className="flex-shrink-0">
                <polyline
                  points={[...history].reverse().map((a, i) =>
                    `${i * (60 / (history.length - 1))},${20 - (a.score / a.total) * 18}`
                  ).join(' ')}
                  fill="none"
                  stroke={history[0].score / history[0].total >= history[history.length - 1].score / history[history.length - 1].total ? '#16a34a' : '#ef4444'}
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          {history.map((a, i) => (
            <div key={i} className="flex justify-between text-xs py-0.5 border-b border-blue-100 last:border-0">
              <span className="text-gray-400">{new Date(a.date).toLocaleDateString()}</span>
              <span className={a.score / a.total >= 0.7 ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                {a.score}/{a.total} ({Math.round(a.score / a.total * 100)}%)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Progress bar (before submit) / Feature 15: Result card (after submit) */}
      {!submitted ? (
        <div className="flex-shrink-0 px-2 pt-1.5 pb-1">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{answeredCount}/{questions.length} answered</span>
            {flagged.size > 0 && <span className="text-yellow-500">⚑ {flagged.size}</span>}
          </div>
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} />
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 mx-2 my-1 p-2 rounded-xl bg-white border border-gray-200">
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-xl font-bold ${pct >= 70 ? 'text-green-600' : 'text-red-500'}`}>
              {Math.round(pct)}%
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct >= 70 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {pct >= 70 ? 'PASS' : 'FAIL'}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium mb-1">Score: {correctCount} / {questions.length} marks</p>
          <div className="grid grid-cols-3 gap-1 text-center text-xs">
            <div><div className="font-bold text-green-600">{correctCount}</div><div className="text-gray-400">✓</div></div>
            <div><div className="font-bold text-red-500">{wrongCount}</div><div className="text-gray-400">✗</div></div>
            <div><div className="font-bold text-gray-500">{skippedCount}</div><div className="text-gray-400">⬜</div></div>
          </div>
          {timerSecs && <div className="text-center text-xs text-gray-400 mt-0.5">⏱ {formatTime(elapsed)}</div>}
          {hasMarkingScheme && onViewMarkingScheme && (
            <button onClick={onViewMarkingScheme}
              className="w-full mt-2 text-xs font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 py-1.5 rounded-lg transition">
              📋 View Marking Scheme
            </button>
          )}
        </div>
      )}

      {/* Review filter tabs (after submit) */}
      {submitted && (
        <div className="flex-shrink-0 flex border-b border-gray-100">
          {reviewTabs.map(tab => (
            <button key={tab.key} onClick={() => setReviewFilter(tab.key)}
              className={`flex-1 py-1 text-xs font-medium transition ${reviewFilter === tab.key ? 'border-b-2 border-blue-500 text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}>
              {tab.label}({tab.count})
            </button>
          ))}
        </div>
      )}

      {/* Answer grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-1 space-y-0.5">
          {displayedQuestions.length === 0 ? (
            <div className="flex items-center justify-center h-16 text-xs text-gray-400">No items</div>
          ) : displayedQuestions.map(q => {
            const qIdx = questionIndex.get(q.id) ?? 0;
            const selected = answers[q.id];
            const isFlagged = flagged.has(q.id);
            const isLocked = instantFeedback && lockedIds.has(q.id);
            const showColors = submitted || isLocked;
            const isCorrect = showColors && selected === q.answer;
            const isWrong = showColors && !!selected && selected !== q.answer;
            const isSkipped = submitted && !selected;
            const isFocused = !submitted && !isLocked && qIdx === focusedQ;
            const isExpanded = submitted && expandedId === q.id;

            return (
              <div
                key={q.id}
                className={`px-1.5 py-1 mx-1 rounded-lg transition-colors
                  ${isFocused ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : ''}
                  ${isCorrect ? 'bg-green-50' : isWrong ? 'bg-red-50' : isSkipped ? 'bg-gray-50' : 'hover:bg-gray-50'}
                  ${isFlagged && !submitted ? 'border-l-2 border-yellow-400' : ''}
                `}
              >
                {/* Row */}
                <div
                  className="flex items-center gap-1 cursor-pointer"
                  onClick={() => {
                    if (submitted) setExpandedId(prev => prev === q.id ? null : q.id);
                    else if (!isLocked) setFocusedQ(qIdx);
                  }}
                >
                  <span className={`text-xs font-bold flex-shrink-0 w-7 ${
                    isCorrect ? 'text-green-700' : isWrong ? 'text-red-700' : isSkipped ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Q{qIdx + 1}
                  </span>

                  <div className="flex gap-0.5 flex-1 min-w-0">
                    {opts.map(opt => {
                      const isSelected = selected === opt;
                      const isAnswer = q.answer === opt;
                      const isOptCorrect = showColors && isAnswer;
                      const isOptWrong = showColors && isSelected && !isAnswer;
                      return (
                        <button
                          key={opt}
                          onClick={e => { e.stopPropagation(); handleSelect(q.id, opt); }}
                          disabled={submitted || isLocked}
                          className={`flex-1 text-xs font-bold py-1 rounded transition-all min-w-0
                            ${isOptCorrect ? 'bg-green-200 text-green-800 border border-green-400'
                            : isOptWrong ? 'bg-red-200 text-red-800 border border-red-400'
                            : isSelected ? 'bg-blue-200 text-blue-800 border border-blue-400'
                            : 'bg-white border border-gray-300 text-gray-500 hover:border-blue-300 hover:bg-blue-50 disabled:cursor-default disabled:hover:bg-white disabled:hover:border-gray-300'
                            }`}
                        >{opt}</button>
                      );
                    })}
                  </div>

                  {/* Flag or expand hint */}
                  {!submitted ? (
                    <button
                      onClick={e => { e.stopPropagation(); toggleFlag(q.id); }}
                      title="Flag question"
                      className={`flex-shrink-0 text-sm leading-none px-0.5 ${isFlagged ? 'text-yellow-500' : 'text-gray-200 hover:text-yellow-400'}`}
                    >⚑</button>
                  ) : (
                    <span className="flex-shrink-0 text-xs text-gray-300 px-0.5">
                      {isExpanded ? '▴' : '▾'}
                    </span>
                  )}
                </div>

                {/* Feature 1: Explanation popup (after submit, when row is expanded) */}
                {isExpanded && (
                  <div className="mt-1 ml-7 text-xs bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-gray-700 leading-relaxed">
                    {q.explanation || <span className="text-gray-400 italic">No explanation provided.</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature 11: Keyboard hint footer */}
      <div className="flex-shrink-0 border-t border-gray-100 px-2 py-1 bg-gray-50">
        <p className="text-xs text-gray-300 text-center truncate">
          {submitted ? '[r] reset · [?] help' : '[a-d] answer · [↑↓] nav · [f] flag · [s] submit · [?] help'}
        </p>
      </div>

      {/* Feature 11: Keyboard shortcut help modal */}
      {showHelp && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 text-sm">MCQ Keyboard Shortcuts</h3>
              <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div className="space-y-1.5">
              {[
                ['a / b / c / d', 'Select option'],
                ['↑ ↓ / j / k', 'Navigate questions'],
                ['f', 'Flag / unflag question'],
                ['s', 'Submit answers'],
                ['r', 'Reset (after submit)'],
                ['?', 'Toggle this help'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <code className="flex-shrink-0 w-28 bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-700 text-center">{key}</code>
                  <span className="text-gray-600">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
