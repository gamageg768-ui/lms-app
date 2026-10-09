'use client';
import { useState } from 'react';
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

export default function StudentSubmissionsClient({ initial }: Props) {
  const [submissions] = useState<PaperSubmission[]>(initial);
  const [selected, setSelected] = useState<PaperSubmission | null>(null);

  return (
    <div className="flex gap-6 min-h-0">
      {/* List */}
      <div className="w-80 flex-shrink-0 space-y-2">
        {submissions.length === 0 && (
          <div className="text-center py-16 text-gray-500 text-sm">
            <p className="text-4xl mb-3">📭</p>
            <p>No submissions yet.</p>
            <p className="text-xs text-gray-400 mt-1">Go to a Past Paper or Model Paper and click "Submit Answer Paper".</p>
          </div>
        )}
        {submissions.map(sub => (
          <button
            key={sub.id}
            onClick={() => setSelected(sub)}
            className={`w-full text-left p-4 rounded-xl border transition-all ${selected?.id === sub.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:shadow-sm hover:border-gray-300'}`}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium text-gray-900 text-sm truncate">{sub.material?.title}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${STATUS_COLORS[sub.status]}`}>
                {sub.status === 'PENDING' ? 'Pending' : 'Reviewed'}
              </span>
            </div>
            <p className="text-xs text-gray-500">{subjectLabel(sub.subject)} · {sectionLabel(sub.section)}</p>
            <p className="text-xs text-gray-400">{fmtDate(sub.submittedAt)}</p>
          </button>
        ))}
      </div>

      {/* Detail */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            Select a submission to view details
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{selected.material?.title}</h3>
                <p className="text-sm text-gray-500">{subjectLabel(selected.subject)} · {sectionLabel(selected.section)}</p>
              </div>
              <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_COLORS[selected.status]}`}>
                {selected.status === 'PENDING' ? 'Pending Review' : 'Reviewed'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-0.5">Submitted</p>
                <p className="font-medium text-gray-800">{fmtDate(selected.submittedAt)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-0.5">File</p>
                <p className="font-medium text-gray-800 truncate">{selected.filename}</p>
                <p className="text-xs text-gray-400">{fmt(selected.fileSize)}</p>
              </div>
            </div>

            {/* View submitted paper */}
            <a
              href={`/api/submissions/${selected.id}/file`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors"
            >
              📄 View My Submitted Paper
            </a>

            {selected.status === 'REVIEWED' ? (
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <h4 className="font-semibold text-gray-900 text-sm">Examiner's Feedback</h4>

                {(selected.score != null || selected.maxScore != null) && (
                  <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-4">
                    <div>
                      <p className="text-xs text-blue-600 font-medium">Your Score</p>
                      <p className="text-3xl font-bold text-blue-900">
                        {selected.score ?? '—'}{selected.maxScore != null ? <span className="text-lg text-blue-600"> / {selected.maxScore}</span> : null}
                      </p>
                    </div>
                    {selected.score != null && selected.maxScore != null && (
                      <div className="flex-1">
                        <div className="w-full bg-blue-200 rounded-full h-2.5">
                          <div
                            className="bg-blue-600 h-2.5 rounded-full"
                            style={{ width: `${Math.min(100, (selected.score / selected.maxScore) * 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-blue-600 mt-1">{Math.round((selected.score / selected.maxScore) * 100)}%</p>
                      </div>
                    )}
                  </div>
                )}

                {selected.feedback && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 font-medium mb-2">Comments from Examiner</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{selected.feedback}</p>
                  </div>
                )}

                {selected.correctedFilename ? (
                  <a
                    href={`/api/submissions/${selected.id}/corrected`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    ✅ View Corrected Paper
                  </a>
                ) : (
                  <p className="text-sm text-gray-500 italic">No corrected paper attached yet.</p>
                )}

                {selected.reviewer && (
                  <p className="text-xs text-gray-400">
                    Reviewed by {selected.reviewer.name}
                    {selected.correctedAt ? ` · ${fmtDate(selected.correctedAt)}` : ''}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-700 border border-amber-200">
                ⏳ Your paper is waiting to be reviewed by the examiner.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
