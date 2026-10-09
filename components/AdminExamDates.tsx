'use client';
import { useState } from 'react';
import { SUBJECTS } from '@/types';

interface ExamDate { id: string; subject: string; label: string; examAt: string; }

export default function AdminExamDates({ initial }: { initial: ExamDate[] }) {
  const [dates, setDates] = useState<ExamDate[]>(initial);
  const [form, setForm] = useState({ subject: SUBJECTS[0].key, label: '', examAt: '' });
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label || !form.examAt) return;
    setSaving(true);
    const res = await fetch('/api/exam-dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setDates(prev => [...prev, data].sort((a, b) => new Date(a.examAt).getTime() - new Date(b.examAt).getTime()));
      setForm({ subject: SUBJECTS[0].key, label: '', examAt: '' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this exam date?')) return;
    const res = await fetch(`/api/exam-dates?id=${id}`, { method: 'DELETE' });
    if (res.ok) setDates(prev => prev.filter(d => d.id !== id));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><span>📅</span> Exam Dates</h2>
      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
        <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value as typeof SUBJECTS[0]['key'] })}
          className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          {SUBJECTS.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
        </select>
        <input type="text" required placeholder="Label (e.g. Paper I)" value={form.label}
          onChange={e => setForm({ ...form, label: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="datetime-local" required value={form.examAt}
          onChange={e => setForm({ ...form, examAt: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60">
          {saving ? '...' : '+ Add'}
        </button>
      </form>
      {dates.length === 0 ? (
        <p className="text-sm text-gray-400">No exam dates set.</p>
      ) : (
        <ul className="space-y-2">
          {dates.map(d => {
            const sub = SUBJECTS.find(s => s.key === d.subject);
            const past = new Date(d.examAt) < new Date();
            return (
              <li key={d.id} className={`flex items-center gap-3 text-sm p-2 rounded-lg ${past ? 'bg-gray-50 opacity-60' : 'bg-blue-50'}`}>
                <span>{sub?.icon ?? '📅'}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-800">{d.label}</span>
                  <span className="text-gray-400 ml-2 text-xs">{sub?.label}</span>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">{new Date(d.examAt).toLocaleString()}</span>
                <button onClick={() => handleDelete(d.id)}
                  className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition flex-shrink-0">✕</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
