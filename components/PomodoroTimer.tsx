'use client';
import { useState, useEffect, useRef } from 'react';

type Phase = 'idle' | 'focus' | 'break';

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

export default function PomodoroTimer() {
  const [minimized, setMinimized] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [cycles, setCycles] = useState(0);
  const [label, setLabel] = useState('');
  const [focusMins, setFocusMins] = useState<25 | 50>(25);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => { if (intervalRef.current) clearInterval(intervalRef.current); };

  useEffect(() => {
    if (phase === 'idle') { clearTimer(); return; }
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          beep();
          if (phase === 'focus') {
            setCycles(c => c + 1);
            setPhase('break');
            return 5 * 60;
          } else {
            setPhase('focus');
            return focusMins * 60;
          }
        }
        return t - 1;
      });
    }, 1000);
    return clearTimer;
  }, [phase, focusMins]);

  const start = () => { setPhase('focus'); setTimeLeft(focusMins * 60); };
  const pause = () => { setPhase('idle'); };
  const reset = () => { clearTimer(); setPhase('idle'); setTimeLeft(focusMins * 60); setCycles(0); };

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');
  const phaseColor = phase === 'focus' ? 'text-blue-400' : phase === 'break' ? 'text-green-400' : 'text-gray-400';

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        title="Pomodoro Timer"
        className={`fixed bottom-4 right-4 z-50 flex items-center gap-1.5 bg-gray-900 text-white rounded-full px-3 py-1.5 text-xs font-mono shadow-lg hover:bg-gray-800 transition ${phase === 'focus' ? 'border border-blue-500' : phase === 'break' ? 'border border-green-500' : 'border border-gray-700'}`}>
        <span>🍅</span>
        {phase !== 'idle' && <span className={phaseColor}>{mm}:{ss}</span>}
        {phase === 'idle' && <span className="text-gray-400">Timer</span>}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white rounded-2xl shadow-2xl w-64 border border-gray-700">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
        <span className="text-sm font-semibold flex items-center gap-1.5">🍅 Pomodoro</span>
        <button onClick={() => setMinimized(true)} className="text-gray-400 hover:text-white text-xs px-1">—</button>
      </div>

      <div className="p-4 space-y-3">
        {/* Session label */}
        <input type="text" value={label} onChange={e => setLabel(e.target.value)}
          placeholder="What are you studying?"
          className="w-full bg-gray-800 text-sm text-white placeholder-gray-500 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700" />

        {/* Duration picker (only when idle) */}
        {phase === 'idle' && (
          <div className="flex gap-2">
            {([25, 50] as const).map(m => (
              <button key={m} onClick={() => { setFocusMins(m); setTimeLeft(m * 60); }}
                className={`flex-1 py-1 text-xs rounded-lg border font-semibold transition ${focusMins === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-blue-500'}`}>
                {m}min
              </button>
            ))}
          </div>
        )}

        {/* Timer display */}
        <div className="text-center">
          <div className={`text-5xl font-black font-mono tabular-nums ${phaseColor}`}>{mm}:{ss}</div>
          <div className="text-xs mt-1 text-gray-400 capitalize">{phase === 'idle' ? 'Ready' : phase === 'focus' ? '🎯 Focus' : '☕ Break'}</div>
          {cycles > 0 && <div className="text-xs text-gray-500 mt-0.5">{cycles} cycle{cycles !== 1 ? 's' : ''} completed</div>}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {phase === 'idle' ? (
            <button onClick={start} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm font-semibold transition">
              ▶ Start
            </button>
          ) : (
            <button onClick={pause} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-xl text-sm font-semibold transition">
              ⏸ Pause
            </button>
          )}
          <button onClick={reset} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm transition">↺</button>
        </div>
      </div>
    </div>
  );
}
