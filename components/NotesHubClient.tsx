'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { SUBJECTS, SECTIONS } from '@/types';

interface Note {
  id: string;
  page: number;
  content: string;
  updatedAt: string;
  material: { id: string; title: string; subject: string; section: string; };
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function sectionSlug(key: string) { return key.toLowerCase().replace(/_/g, '-'); }
function subjectSlug(key: string) { return key.toLowerCase().replace(/_/g, '-'); }

export default function NotesHubClient({ notes }: { notes: Note[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return notes;
    const q = query.toLowerCase();
    return notes.filter(n => n.content.toLowerCase().includes(q) || n.material.title.toLowerCase().includes(q));
  }, [notes, query]);

  // Group by subject
  const grouped = useMemo(() => {
    const map: Record<string, Note[]> = {};
    for (const n of filtered) {
      const key = n.material.subject;
      if (!map[key]) map[key] = [];
      map[key].push(n);
    }
    return map;
  }, [filtered]);

  if (notes.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <div className="text-5xl mb-4">📝</div>
        <p className="font-semibold text-gray-600">No notes yet</p>
        <p className="text-sm mt-1">Open a PDF and use the Notes panel to write annotations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <input type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search notes..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
        </svg>
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">✕</button>
        )}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-center text-gray-400 py-10">No notes match your search.</p>
      ) : (
        Object.entries(grouped).map(([subjectKey, subjectNotes]) => {
          const subjectInfo = SUBJECTS.find(s => s.key === subjectKey);
          return (
            <div key={subjectKey} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 bg-gray-50 border-b border-gray-200">
                <span className="text-lg">{subjectInfo?.icon ?? '📚'}</span>
                <h2 className="font-bold text-gray-800">{subjectInfo?.label ?? subjectKey}</h2>
                <span className="ml-auto text-xs text-gray-400">{subjectNotes.length} note{subjectNotes.length !== 1 ? 's' : ''}</span>
              </div>
              <ul className="divide-y divide-gray-100">
                {subjectNotes.map(note => {
                  const sectionInfo = SECTIONS.find(s => s.key === note.material.section);
                  const href = `/subject/${subjectSlug(note.material.subject)}/${sectionSlug(note.material.section)}`;
                  return (
                    <li key={note.id} className="px-5 py-3 hover:bg-gray-50 transition">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-semibold text-gray-600 truncate">{note.material.title}</span>
                            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{sectionInfo?.label ?? note.material.section}</span>
                            <span className="text-xs text-blue-500 font-medium">p.{note.page}</span>
                          </div>
                          <p className="text-sm text-gray-700 line-clamp-2">{note.content}</p>
                          <p className="text-xs text-gray-400 mt-1">{timeAgo(note.updatedAt)}</p>
                        </div>
                        <Link href={href}
                          className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition whitespace-nowrap">
                          Open →
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}
