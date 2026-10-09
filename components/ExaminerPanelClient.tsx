'use client';
import { useState, useRef } from 'react';
import { PaperSubmission, SUBJECTS, SECTIONS } from '@/types';

interface Props {
  initial: PaperSubmission[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  REVIEWED: 'bg-green-100 text-green-700',
};

function subjectLabel(key: string) { return SUBJECTS.find(s => s.key === key)?.label ?? key; }
function sectionLabel(key: string) { return SECTIONS.find(s => s.key === key)?.label ?? key; }
function fmt(bytes: number) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function fmtDate(iso: string) { return new Date(iso).toLocaleString(); }

export default function ExaminerPanelClient({ initial }: Props) {
  const [submissions, setSubmissions] = useState<PaperSubmission[]>(initial);
  const [selected, setSelected] = useState<PaperSubmission | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Review form state
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [correctedFile, setCorrectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = submissions.filter(s => {
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterSubject && s.subject !== filterSubject) return false;
    return true;
  });

  const openReview = (sub: PaperSubmission) => {
    setSelected(sub);
    setFeedback(sub.feedback ?? '');
    setScore(sub.score != null ? String(sub.score) : '');
    setMaxScore(sub.maxScore != null ? String(sub.maxScore) : '');
    setCorrectedFile(null);
    setReviewError('');
    setReviewing(true);
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setReviewError('');

    const fd = new FormData();
    if (feedback) fd.append('feedback', feedback);
    if (score) fd.append('score', score);
    if (maxScore) fd.append('maxScore', maxScore);
    if (correctedFile) fd.append('correctedFile', correctedFile);

    try {
      const res = await fetch(`/api/submissions/${selected.id}/review`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setReviewError(data.error ?? 'Failed to save review'); return; }
      setSubmissions(prev => prev.map(s => s.id === data.id ? data : s));
      setSelected(data);
      setReviewing(false);
    } catch {
      setReviewError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full gap-6">
      {/* Left: submission list */}
      <div className="w-96 flex-shrink-0 flex flex-col gap-4">
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="REVIEWED">Reviewed</option>
          </select>
          <select
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All subjects</option>
            {SUBJECTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-sm text-gray-500 py-8 text-center">No submissions found.</p>
          )}
          {filtered.map(sub => (
            <button
              key={sub.id}
              onClick={() => { setSelected(sub); setReviewing(false); }}
              className={`text-left p-4 rounded-xl border transition-all ${selected?.id === sub.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-medium text-gray-900 text-sm leading-tight line-clamp-1">{sub.student?.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[sub.status]}`}>
                  {sub.status === 'PENDING' ? 'Pending' : 'Reviewed'}
                </span>
              </div>
              <p className="text-xs text-gray-600 line-clamp-1">{sub.material?.title}</p>
              <p className="text-xs text-gray-400 mt-1">{subjectLabel(sub.subject)} · {sectionLabel(sub.section)}</p>
              <p className="text-xs text-gray-400">{fmtDate(sub.submittedAt)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right: detail / review form */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            Select a submission to review
          </div>
        ) : reviewing ? (
          <form onSubmit={handleReview} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Review Submission</h3>
              <button type="button" onClick={() => setReviewing(false)} className="text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
              <p><span className="font-medium">Student:</span> {selected.student?.name} ({selected.student?.email})</p>
              <p><span className="font-medium">Paper:</span> {selected.material?.title}</p>
              <p><span className="font-medium">Submitted:</span> {fmtDate(selected.submittedAt)}</p>
            </div>

            {/* Score */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-700 block mb-1">Score (optional)</label>
                <input
                  type="number" min="0" value={score}
                  onChange={e => setScore(e.target.value)}
                  placeholder="e.g. 45"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-700 block mb-1">Out of (optional)</label>
                <input
                  type="number" min="1" value={maxScore}
                  onChange={e => setMaxScore(e.target.value)}
                  placeholder="e.g. 75"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Feedback */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Feedback / Comments</label>
              <textarea
                rows={4}
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="General feedback for the student…"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Corrected paper upload */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">Corrected Paper PDF (optional)</label>
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => setCorrectedFile(e.target.files?.[0] ?? null)}
                />
                {correctedFile ? (
                  <div>
                    <p className="text-sm font-medium text-gray-800 truncate">{correctedFile.name}</p>
                    <p className="text-xs text-gray-500">{fmt(correctedFile.size)}</p>
                  </div>
                ) : selected.correctedFilename ? (
                  <p className="text-sm text-gray-600">Current: <span className="font-medium">{selected.correctedFilename}</span> — click to replace</p>
                ) : (
                  <p className="text-sm text-gray-500">Click to attach corrected PDF</p>
                )}
              </div>
            </div>

            {reviewError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{reviewError}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Review & Return Paper'}
            </button>
          </form>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{selected.student?.name}</h3>
                <p className="text-sm text-gray-500">{selected.student?.email}</p>
              </div>
              <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_COLORS[selected.status]}`}>
                {selected.status === 'PENDING' ? 'Pending Review' : 'Reviewed'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-0.5">Paper</p>
                <p className="font-medium text-gray-900">{selected.material?.title}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-0.5">Subject / Section</p>
                <p className="font-medium text-gray-900">{subjectLabel(selected.subject)} · {sectionLabel(selected.section)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-0.5">Submitted</p>
                <p className="font-medium text-gray-900">{fmtDate(selected.submittedAt)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-0.5">File size</p>
                <p className="font-medium text-gray-900">{fmt(selected.fileSize)}</p>
              </div>
            </div>

            {/* View student's answer paper */}
            <div>
              <a
                href={`/api/submissions/${selected.id}/file`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors"
              >
                📄 View Student's Answer Paper
              </a>
            </div>

            {/* Score + feedback if reviewed */}
            {selected.status === 'REVIEWED' && (
              <div className="space-y-3">
                {(selected.score != null || selected.maxScore != null) && (
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-xs text-blue-600 font-medium mb-1">Score</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {selected.score ?? '—'}{selected.maxScore != null ? ` / ${selected.maxScore}` : ''}
                    </p>
                  </div>
                )}
                {selected.feedback && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 font-medium mb-1">Examiner Feedback</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{selected.feedback}</p>
                  </div>
                )}
                {selected.correctedFilename && (
                  <a
                    href={`/api/submissions/${selected.id}/corrected`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 hover:bg-green-200 rounded-xl text-sm font-medium text-green-800 transition-colors"
                  >
                    ✅ View Corrected Paper
                  </a>
                )}
                {selected.reviewer && (
                  <p className="text-xs text-gray-400">Reviewed by {selected.reviewer.name} · {selected.correctedAt ? fmtDate(selected.correctedAt) : ''}</p>
                )}
              </div>
            )}

            <button
              onClick={() => openReview(selected)}
              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors"
            >
              {selected.status === 'REVIEWED' ? 'Edit Review' : 'Review & Return Paper'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
