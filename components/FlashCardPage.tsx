'use client';
import { useState, useEffect, useMemo } from 'react';
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
type MasteryFilter = 'all' | 'new' | 'weak';

interface Mastery {
  easy: string[];
  medium: string[];
  hard: string[];
}

function emptyMastery(): Mastery { return { easy: [], medium: [], hard: [] }; }

export default function FlashCardPage({ cards, subjectLabel, backHref, subject }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [filter, setFilter] = useState<MasteryFilter>('all');
  const [aiTab, setAiTab] = useState(false);

  // Feature 10: Mastery tracking from localStorage
  const [mastery, setMastery] = useState<Mastery>(emptyMastery());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`lms-flashcard-mastery-${subject}`);
      if (raw) setMastery(JSON.parse(raw));
    } catch {}
  }, [subject]);

  const saveMastery = (updatedMastery: Mastery) => {
    setMastery(updatedMastery);
    try { localStorage.setItem(`lms-flashcard-mastery-${subject}`, JSON.stringify(updatedMastery)); } catch {}
  };

  // Filtered cards based on mastery filter
  const filteredCards = useMemo(() => {
    if (filter === 'new') return cards.filter(c => !mastery.easy.includes(c.id) && !mastery.medium.includes(c.id) && !mastery.hard.includes(c.id));
    if (filter === 'weak') return cards.filter(c => mastery.medium.includes(c.id) || mastery.hard.includes(c.id));
    return cards;
  }, [cards, filter, mastery]);

  const [cardIndex, setCardIndex] = useState(0);

  // Reset index when filter changes
  useEffect(() => { setCardIndex(0); setFlipped(false); }, [filter]);

  const card = filteredCards[cardIndex];
  const total = filteredCards.length;
  const ratedInSession = Object.keys(ratings).length;

  const masteredCount = mastery.easy.length;
  const learningCount = mastery.medium.length + mastery.hard.length;
  const newCount = cards.length - masteredCount - learningCount;
  const progressPct = cards.length > 0 ? ((masteredCount + learningCount) / cards.length) * 100 : 0;

  const rate = (r: Rating) => {
    if (!card) return;

    // Update session ratings
    setRatings(prev => ({ ...prev, [card.id]: r }));

    // Update persistent mastery
    const updated: Mastery = {
      easy: mastery.easy.filter(id => id !== card.id),
      medium: mastery.medium.filter(id => id !== card.id),
      hard: mastery.hard.filter(id => id !== card.id),
    };
    updated[r] = [...updated[r], card.id];
    saveMastery(updated);

    // Auto-advance to next card
    setFlipped(false);
    setTimeout(() => {
      setCardIndex(i => {
        if (i + 1 >= filteredCards.length) return 0;
        return i + 1;
      });
    }, 250);
  };

  const resetMastery = () => {
    saveMastery(emptyMastery());
    setRatings({});
    setCardIndex(0);
    setFlipped(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2">
        <Link href={backHref} className="text-gray-400 hover:text-gray-700 text-sm">← {subjectLabel}</Link>
        <span className="text-gray-300">/</span>
        <span className="font-semibold text-gray-800">Flash Cards</span>
      </div>

      {/* Mastery summary bar (hidden when in AI tab with no cards) */}
      {(cards.length > 0 || !aiTab) && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5">
          {cards.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-4 text-xs">
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

          {/* Filter tabs + AI tab */}
          <div className="flex gap-2">
            {cards.length > 0 && ([['all', `All (${cards.length})`], ['weak', `Hard/Med (${learningCount})`], ['new', `New (${newCount})`]] as [MasteryFilter, string][]).map(([key, label]) => (
              <button key={key} onClick={() => { setFilter(key); setAiTab(false); }}
                className={`flex-1 text-xs py-1.5 rounded-xl border font-medium transition ${!aiTab && filter === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                {label}
              </button>
            ))}
            <button onClick={() => setAiTab(a => !a)}
              className={`flex-1 text-xs py-1.5 rounded-xl border font-medium transition ${aiTab ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-600 border-purple-200 hover:border-purple-400'}`}>
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
          <div className="text-4xl mb-3">🎉</div>
          <p className="font-semibold text-gray-700">
            {filter === 'new' ? 'All cards rated!' : 'No cards in this filter'}
          </p>
          <button onClick={() => setFilter('all')} className="mt-3 text-sm text-blue-600 hover:underline">Show all cards</button>
        </div>
      ) : (
        <>
          {/* Card navigation header */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { setCardIndex(i => (i - 1 + total) % total); setFlipped(false); }}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-50 text-sm font-medium transition">
              ← Prev
            </button>
            <span className="text-sm text-gray-500">
              {cardIndex + 1} / {total}
              {ratedInSession > 0 && <span className="ml-2 text-xs text-blue-500">({ratedInSession} rated)</span>}
            </span>
            <button onClick={() => { setCardIndex(i => (i + 1) % total); setFlipped(false); }}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-50 text-sm font-medium transition">
              Next →
            </button>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${((cardIndex + 1) / total) * 100}%` }} />
            </div>
          </div>

          {/* Flip card */}
          <div
            className="w-full cursor-pointer mb-5"
            style={{ height: '280px', perspective: '1000px' }}
            onClick={() => setFlipped(f => !f)}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                transformStyle: 'preserve-3d',
                transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
                transform: flipped ? 'rotateY(180deg)' : 'none',
              }}
            >
              <div
                style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                className="bg-white border-2 border-blue-200 rounded-2xl shadow-md flex flex-col items-center justify-center p-8"
              >
                <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">Question</div>
                <p className="text-xl font-semibold text-gray-800 text-center leading-relaxed">{card.question}</p>
                <p className="text-xs text-gray-400 mt-6">Tap to reveal answer →</p>
                {ratings[card.id] && (
                  <span className={`absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-bold ${
                    ratings[card.id] === 'easy' ? 'bg-green-100 text-green-700'
                    : ratings[card.id] === 'medium' ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                  }`}>
                    {ratings[card.id]}
                  </span>
                )}
              </div>

              <div
                style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                className="bg-blue-600 border-2 border-blue-700 rounded-2xl shadow-md flex flex-col items-center justify-center p-8"
              >
                <div className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-4">Answer</div>
                <p className="text-xl font-semibold text-white text-center leading-relaxed">{card.answer}</p>
              </div>
            </div>
          </div>

          {/* Rating buttons */}
          {flipped ? (
            <div className="grid grid-cols-3 gap-3">
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
            <div className="text-center">
              <button onClick={() => setFlipped(true)}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition text-sm">
                👁 Show Answer
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
