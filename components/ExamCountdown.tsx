'use client';
import { useState, useEffect } from 'react';
import { SUBJECTS } from '@/types';

interface ExamDate {
  id: string;
  subject: string;
  label: string;
  examAt: string;
}

function useCountdown(targetDate: string) {
  const [diff, setDiff] = useState(0);

  useEffect(() => {
    const update = () => setDiff(Math.max(0, new Date(targetDate).getTime() - Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return { days, hours, mins, secs, diff };
}

function CountdownCard({ date }: { date: ExamDate }) {
  const { days, hours, mins, secs, diff } = useCountdown(date.examAt);
  const subject = SUBJECTS.find(s => s.key === date.subject);
  const urgent = days < 7;
  const soon = days < 14;

  return (
    <div className={`rounded-xl border p-4 ${urgent ? 'border-red-200 bg-red-50' : soon ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{subject?.icon ?? '📅'}</span>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{subject?.label ?? date.subject}</p>
          <p className="text-sm font-bold text-gray-800">{date.label}</p>
        </div>
      </div>
      {diff === 0 ? (
        <p className="text-sm font-bold text-gray-500">Exam has passed</p>
      ) : (
        <div className="flex gap-2">
          {[{ v: days, u: 'd' }, { v: hours, u: 'h' }, { v: mins, u: 'm' }, { v: secs, u: 's' }].map(({ v, u }) => (
            <div key={u} className={`flex-1 text-center rounded-lg py-1.5 ${urgent ? 'bg-red-100' : soon ? 'bg-orange-100' : 'bg-green-100'}`}>
              <div className={`text-lg font-black tabular-nums ${urgent ? 'text-red-700' : soon ? 'text-orange-700' : 'text-green-700'}`}>{String(v).padStart(2, '0')}</div>
              <div className="text-xs text-gray-500">{u}</div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-2">{new Date(date.examAt).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
    </div>
  );
}

export default function ExamCountdown({ examDates }: { examDates: ExamDate[] }) {
  if (examDates.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <span>📅</span> Upcoming Exams
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {examDates.map(d => <CountdownCard key={d.id} date={d} />)}
      </div>
    </div>
  );
}
