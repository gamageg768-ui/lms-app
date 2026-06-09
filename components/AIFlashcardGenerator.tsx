'use client';
import { useState } from 'react';

interface GeneratedCard {
  question: string;
  answer: string;
}

type Rating = 'easy' | 'medium' | 'hard';

interface Props {
  subject: string;
}

export default function AIFlashcardGenerator({ subject }: Props) {
  const [text, setText] = useState('');
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [studyMode, setStudyMode] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<number, Rating>>({});

  const generate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/generate-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, subject, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      if (!data.cards?.length) throw new Error('No cards returned. Try with more detailed text.');
      setCards(data.cards);
      setStudyMode(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const startStudy = () => {
    setStudyMode(true);
    setCardIndex(0);
    setFlipped(false);
    setRatings({});
  };

  const rate = (r: Rating) => {
    setRatings(prev => ({ ...prev, [cardIndex]: r }));
    setFlipped(false);
    setTimeout(() => setCardIndex(i => (i + 1 >= cards.length ? 0 : i + 1)), 250);
  };

  if (studyMode && cards.length > 0) {
    const card = cards[cardIndex];
    const ratedCount = Object.keys(ratings).length;
    return (
      <div className="py-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setStudyMode(false)}
            className="text-xs text-gray-400 hover:text-gray-700 transition">← Back to generator</button>
          <span className="text-sm text-gray-500">{cardIndex + 1} / {cards.length}</span>
          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">✨ AI Cards</span>
        </div>

        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-5">
          <div className="h-full bg-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${((cardIndex + 1) / cards.length) * 100}%` }} />
        </div>

        {ratedCount > 0 && (
          <div className="flex gap-3 mb-4 text-xs">
            {(['easy', 'medium', 'hard'] as Rating[]).map(r => {
              const n = Object.values(ratings).filter(v => v === r).length;
              if (!n) return null;
              return (
                <span key={r} className={`px-2 py-0.5 rounded-full font-medium ${
                  r === 'easy' ? 'bg-green-100 text-green-700'
                  : r === 'medium' ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
                }`}>{n} {r}</span>
              );
            })}
          </div>
        )}

        <div className="w-full cursor-pointer mb-5" style={{ height: '260px', perspective: '1000px' }}
          onClick={() => setFlipped(f => !f)}>
          <div style={{
            position: 'relative', width: '100%', height: '100%',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
            transform: flipped ? 'rotateY(180deg)' : 'none',
          }}>
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' as any }}
              className="bg-white border-2 border-purple-200 rounded-2xl shadow-md flex flex-col items-center justify-center p-8">
              <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-4">Question</div>
              <p className="text-lg font-semibold text-gray-800 text-center leading-relaxed">{card.question}</p>
              <p className="text-xs text-gray-400 mt-6">Tap to reveal answer →</p>
              {ratings[cardIndex] && (
                <span className={`absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-bold ${
                  ratings[cardIndex] === 'easy' ? 'bg-green-100 text-green-700'
                  : ratings[cardIndex] === 'medium' ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
                }`}>{ratings[cardIndex]}</span>
              )}
            </div>

            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' as any, transform: 'rotateY(180deg)' }}
              className="bg-purple-600 border-2 border-purple-700 rounded-2xl shadow-md flex flex-col items-center justify-center p-8">
              <div className="text-xs font-bold text-purple-200 uppercase tracking-widest mb-4">Answer</div>
              <p className="text-lg font-semibold text-white text-center leading-relaxed">{card.answer}</p>
            </div>
          </div>
        </div>

        {flipped ? (
          <div className="grid grid-cols-3 gap-3">
            {(['hard', 'medium', 'easy'] as Rating[]).map(r => (
              <button key={r} onClick={() => rate(r)}
                className={`py-3 rounded-xl border-2 font-semibold text-sm transition ${
                  r === 'hard' ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                  : r === 'medium' ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                }`}>
                {r === 'hard' ? '😰 Hard' : r === 'medium' ? '😐 Medium' : '😊 Easy'}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center">
            <button onClick={() => setFlipped(true)}
              className="bg-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-purple-700 transition text-sm">
              👁 Show Answer
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-4 space-y-5">
      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-purple-700 font-bold text-sm">✨ AI Flashcard Generator</span>
          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">Pro</span>
        </div>
        <p className="text-xs text-purple-700">Paste notes, a textbook paragraph, or any study material — AI extracts key concepts as study-ready flashcards.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Study text</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={7}
          placeholder="Paste your notes or study material here..."
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400 resize-none transition"
        />
        <p className="text-xs text-gray-400 mt-1">
          {text.length} chars{text.length > 4000 ? ' — trimmed to first 4000' : ''}
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Number of flashcards</label>
        <div className="flex gap-2">
          {[5, 10, 15, 20].map(n => (
            <button key={n} onClick={() => setCount(n)}
              className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition ${
                count === n ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
              }`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
          {error}
        </div>
      )}

      <button
        onClick={generate}
        disabled={loading || !text.trim()}
        className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating flashcards…
          </>
        ) : '✨ Generate Flashcards'}
      </button>

      {cards.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">{cards.length} cards generated</span>
            <button onClick={startStudy}
              className="bg-purple-600 text-white px-4 py-1.5 rounded-xl text-xs font-semibold hover:bg-purple-700 transition">
              Study These Cards →
            </button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {cards.map((c, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-700 mb-1">Q: {c.question}</p>
                <p className="text-xs text-gray-500">A: {c.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
