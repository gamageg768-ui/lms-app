'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { formatFileSize } from '@/lib/utils';

interface Material { id: string; title: string; description: string | null; subject: string; section: string; filename: string; fileSize: number; uploadedById: string; createdAt: string; updatedAt: string; markingSchemePath?: string | null; markingSchemeFilename?: string | null; markingSchemeFileSize?: number | null; }
interface MCQQuestion { id: string; mcqSetId: string; question: string; optionA: string; optionB: string; optionC: string; optionD: string; optionE: string | null; answer: string; explanation: string | null; order: number; }
interface MCQSet { id: string; title: string; subject: string; section: string; materialId: string | null; questionCount: number; optionCount: number; questions: MCQQuestion[]; createdAt: string; updatedAt: string; }
interface FlashCard { id: string; subject: string; question: string; answer: string; order: number; createdAt: string; updatedAt: string; }
interface User { id: string; name: string; email: string; }
interface Permission { id: string; userId: string; materialId: string; grantedAt: string; }

interface Props {
  subjectKey: string; sectionKey: string; subjectLabel: string; sectionLabel: string;
  hasMCQ?: boolean; materials: Material[]; mcqSets: MCQSet[]; flashCards: FlashCard[];
  users?: User[]; permissions?: Permission[]; backHref: string;
}

type Tab = 'materials' | 'mcq' | 'flashcards' | 'permissions';

export default function AdminSectionClient({
  subjectKey, sectionKey, subjectLabel, sectionLabel,
  hasMCQ, materials: initMaterials, mcqSets: initMCQSets,
  flashCards: initFlashCards, users = [], permissions: initPerms = [], backHref,
}: Props) {
  const [tab, setTab] = useState<Tab>(sectionKey === 'FLASH_CARDS' ? 'flashcards' : 'materials');
  const [materials, setMaterials] = useState(initMaterials);
  const [mcqSets, setMcqSets] = useState(initMCQSets);
  const [flashCards, setFlashCards] = useState(initFlashCards);
  const [permissions, setPermissions] = useState(initPerms);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', description: '', file: null as File | null, markingSchemeFile: null as File | null });

  // Marking scheme upload state (per-row)
  const [msUploading, setMsUploading] = useState<string | null>(null); // materialId being uploaded

  // MCQ state
  const [selectedSet, setSelectedSet] = useState<MCQSet | null>(null);
  const [newSetTitle, setNewSetTitle] = useState('');
  const [newSetMaterialId, setNewSetMaterialId] = useState('');
  const [newSetCount, setNewSetCount] = useState(50);
  const [newSetOptions, setNewSetOptions] = useState(4);
  const [creatingSet, setCreatingSet] = useState(false);
  const [addMoreCount, setAddMoreCount] = useState(10);
  const [addMoreGenerating, setAddMoreGenerating] = useState(false);
  const [deletingSet, setDeletingSet] = useState(false);
  const [answerKeyInput, setAnswerKeyInput] = useState('');
  const [applyingKey, setApplyingKey] = useState(false);

  // CSV import state
  const [mcqRightTab, setMcqRightTab] = useState<'answers' | 'csv'>('answers');
  const [csvInput, setCsvInput] = useState('');
  const [csvPreview, setCsvPreview] = useState<{ valid: number; total: number } | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);

  // Flash card state
  const [newCard, setNewCard] = useState({ question: '', answer: '' });

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file || !uploadForm.title) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', uploadForm.file);
    fd.append('title', uploadForm.title);
    fd.append('description', uploadForm.description);
    fd.append('subject', subjectKey);
    fd.append('section', sectionKey);
    if (uploadForm.markingSchemeFile) fd.append('markingSchemeFile', uploadForm.markingSchemeFile);
    const res = await fetch('/api/materials', { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);
    if (res.ok) {
      setMaterials([data, ...materials]);
      setUploadForm({ title: '', description: '', file: null, markingSchemeFile: null });
    } else {
      alert(data.error || 'Upload failed');
    }
  };

  const handleUploadMarkingScheme = async (materialId: string, file: File) => {
    setMsUploading(materialId);
    const fd = new FormData();
    fd.append('markingSchemeFile', file);
    const res = await fetch(`/api/materials/${materialId}/marking-scheme`, { method: 'POST', body: fd });
    const data = await res.json();
    setMsUploading(null);
    if (res.ok) {
      setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, markingSchemeFilename: data.markingSchemeFilename, markingSchemePath: data.markingSchemePath, markingSchemeFileSize: data.markingSchemeFileSize } : m));
    } else {
      alert(data.error || 'Upload failed');
    }
  };

  const handleDeleteMarkingScheme = async (materialId: string) => {
    if (!confirm('Remove marking scheme from this material?')) return;
    const res = await fetch(`/api/materials/${materialId}/marking-scheme`, { method: 'DELETE' });
    if (res.ok) {
      setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, markingSchemeFilename: null, markingSchemePath: null, markingSchemeFileSize: null } : m));
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm('Delete this material? This cannot be undone.')) return;
    const res = await fetch(`/api/materials/${id}`, { method: 'DELETE' });
    if (res.ok) setMaterials(materials.filter((m) => m.id !== id));
  };

  const syncSet = (updated: MCQSet) => {
    setSelectedSet(updated);
    setMcqSets(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const handleCreateAndGenerate = async () => {
    if (!newSetTitle.trim()) return;
    setCreatingSet(true);
    // Step 1: create set
    const res = await fetch('/api/mcq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newSetTitle, subject: subjectKey, section: sectionKey, materialId: newSetMaterialId || null, optionCount: newSetOptions }),
    });
    const newSet = await res.json();
    if (!res.ok) { setCreatingSet(false); alert(newSet.error || 'Failed to create set'); return; }

    // Step 2: bulk generate questions
    let finalSet = newSet;
    if (newSetCount > 0) {
      const bRes = await fetch(`/api/mcq/sets/${newSet.id}/questions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: newSetCount, optionCount: newSetOptions }),
      });
      const bData = await bRes.json();
      if (bRes.ok && bData.set) finalSet = bData.set;
    }
    setMcqSets(prev => [finalSet, ...prev]);
    setSelectedSet(finalSet);
    setNewSetTitle('');
    setNewSetMaterialId('');
    setCreatingSet(false);
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!selectedSet) return;
    const res = await fetch(`/api/mcq/sets/${selectedSet.id}/questions/${qId}`, { method: 'DELETE' });
    if (res.ok) syncSet({ ...selectedSet, questions: selectedSet.questions.filter(q => q.id !== qId) });
  };

  const handleDeleteSet = async () => {
    if (!selectedSet || !confirm(`Delete "${selectedSet.title}" and all its questions? This cannot be undone.`)) return;
    setDeletingSet(true);
    const res = await fetch(`/api/mcq/sets/${selectedSet.id}`, { method: 'DELETE' });
    if (res.ok) {
      setMcqSets(prev => prev.filter(s => s.id !== selectedSet.id));
      setSelectedSet(null);
    }
    setDeletingSet(false);
  };

  const handleAddMore = async () => {
    if (!selectedSet || addMoreCount < 1) return;
    setAddMoreGenerating(true);
    const res = await fetch(`/api/mcq/sets/${selectedSet.id}/questions/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: addMoreCount, optionCount: selectedSet.optionCount ?? 4 }),
    });
    const data = await res.json();
    if (res.ok && data.set) syncSet(data.set);
    else alert('Failed to add questions');
    setAddMoreGenerating(false);
  };

  const handleApplyAnswerKey = async () => {
    if (!selectedSet || !answerKeyInput.trim()) return;
    const maxChar = selectedSet.optionCount >= 5 ? 'E' : 'D';
    const validRe = new RegExp(`^[A-${maxChar}]$`);
    const validAnswers = answerKeyInput.toUpperCase().replace(/[^A-E]/g, '').split('').filter(c => validRe.test(c));
    if (validAnswers.length === 0) { alert(`No valid answers (use A–${maxChar})`); return; }
    setApplyingKey(true);
    const updates = selectedSet.questions.slice(0, validAnswers.length).map((q, i) => ({ id: q.id, answer: validAnswers[i] }));
    const res = await fetch(`/api/mcq/sets/${selectedSet.id}/questions/bulk`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    if (res.ok) {
      syncSet({ ...selectedSet, questions: selectedSet.questions.map((q, i) => i < updates.length ? { ...q, answer: updates[i].answer } : q) });
      setAnswerKeyInput('');
    } else alert('Failed to apply answer key');
    setApplyingKey(false);
  };

  const handleSetAnswer = async (qId: string, answer: string) => {
    if (!selectedSet) return;
    await fetch(`/api/mcq/sets/${selectedSet.id}/questions/${qId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer }),
    });
    syncSet({ ...selectedSet, questions: selectedSet.questions.map(q => q.id === qId ? { ...q, answer } : q) });
  };

  const handleAddCard = async () => {
    if (!newCard.question.trim() || !newCard.answer.trim()) return;
    const res = await fetch('/api/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: subjectKey, ...newCard, order: flashCards.length }),
    });
    const data = await res.json();
    if (res.ok) { setFlashCards([...flashCards, data]); setNewCard({ question: '', answer: '' }); }
  };

  const handleDeleteCard = async (id: string) => {
    const res = await fetch(`/api/flashcards/${id}`, { method: 'DELETE' });
    if (res.ok) setFlashCards(flashCards.filter((c) => c.id !== id));
  };

  const handleGrantPermission = async (userId: string, materialId: string) => {
    const res = await fetch('/api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, materialId }),
    });
    const data = await res.json();
    if (res.ok) setPermissions([...permissions, data]);
  };

  const handleRevokePermission = async (userId: string, materialId: string) => {
    const res = await fetch(`/api/permissions?userId=${userId}&materialId=${materialId}`, { method: 'DELETE' });
    if (res.ok) setPermissions(permissions.filter((p) => !(p.userId === userId && p.materialId === materialId)));
  };

  const hasPermission = (userId: string, materialId: string) =>
    permissions.some((p) => p.userId === userId && p.materialId === materialId);

  const parseCSV = useCallback((raw: string) => {
    const maxChar = selectedSet ? (selectedSet.optionCount >= 5 ? 'E' : 'D') : 'D';
    const validRe = new RegExp(`^[A-${maxChar}]$`);
    const lines = raw.trim().split('\n').filter(l => l.trim());
    const questions: { question: string; optionA: string; optionB: string; optionC: string; optionD: string; optionE?: string; answer: string; explanation?: string }[] = [];
    for (const line of lines) {
      // simple CSV split (handles quoted fields)
      const cols: string[] = [];
      let cur = '';
      let inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      cols.push(cur.trim());
      if (cols.length < 6) continue;
      const q = cols[0];
      if (!q) continue;
      // 5-option: q,A,B,C,D,E,answer[,explanation] (≥7 cols and set uses 5 options)
      const has5Options = cols.length >= 7 && selectedSet && (selectedSet.optionCount ?? 4) >= 5;
      const answerIdx = has5Options ? 6 : 5;
      const finalAnswer = (cols[answerIdx] ?? '').toUpperCase();
      if (!validRe.test(finalAnswer)) continue;
      questions.push({
        question: q,
        optionA: cols[1] || '',
        optionB: cols[2] || '',
        optionC: cols[3] || '',
        optionD: cols[4] || '',
        ...(has5Options ? { optionE: cols[5] || '' } : {}),
        answer: finalAnswer,
        ...(cols[answerIdx + 1] ? { explanation: cols[answerIdx + 1] } : {}),
      });
    }
    return questions;
  }, [selectedSet]);

  const handleCSVPreview = () => {
    if (!csvInput.trim()) return;
    const parsed = parseCSV(csvInput);
    const total = csvInput.trim().split('\n').filter(l => l.trim()).length;
    setCsvPreview({ valid: parsed.length, total });
  };

  const handleCSVImport = async () => {
    if (!selectedSet || !csvInput.trim()) return;
    const questions = parseCSV(csvInput);
    if (questions.length === 0) { alert('No valid questions found'); return; }
    setCsvImporting(true);
    const res = await fetch(`/api/mcq/sets/${selectedSet.id}/questions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions }),
    });
    const data = await res.json();
    setCsvImporting(false);
    if (res.ok && data.set) {
      syncSet(data.set);
      setCsvInput('');
      setCsvPreview(null);
      alert(`Imported ${data.imported} questions successfully`);
    } else {
      alert(data.error || 'Import failed');
    }
  };

  const tabs = [
    ...(sectionKey !== 'FLASH_CARDS' ? [{ key: 'materials', label: 'Materials', count: materials.length }] : []),
    ...(hasMCQ ? [{ key: 'mcq', label: 'MCQ Sets', count: mcqSets.length }] : []),
    ...(sectionKey === 'FLASH_CARDS' ? [{ key: 'flashcards', label: 'Flash Cards', count: flashCards.length }] : []),
    ...(sectionKey !== 'FLASH_CARDS' ? [{ key: 'permissions', label: 'Permissions', count: permissions.length }] : []),
  ] as { key: Tab; label: string; count: number }[];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link href={backHref} className="text-gray-400 hover:text-gray-700 text-sm">← {subjectLabel}</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{subjectLabel} — {sectionLabel}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label} <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* MATERIALS TAB */}
      {tab === 'materials' && (
        <div className="space-y-6">
          {/* Upload form */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-bold text-gray-900 mb-4">Upload PDF</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input type="text" required value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="e.g. 2023 A/L Past Paper" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input type="text" value={uploadForm.description}
                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Optional description" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PDF File *</label>
                <input type="file" accept=".pdf" required
                  onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] ?? null })}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Marking Scheme PDF <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="file" accept=".pdf"
                  onChange={(e) => setUploadForm({ ...uploadForm, markingSchemeFile: e.target.files?.[0] ?? null })}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
              </div>
              <button type="submit" disabled={uploading}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-60 text-sm">
                {uploading ? 'Uploading...' : 'Upload PDF'}
              </button>
            </form>
          </div>

          {/* Materials list */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Uploaded Materials ({materials.length})</h2>
            </div>
            {materials.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm">No materials uploaded yet</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-6 py-3 text-left">Title</th>
                    <th className="px-6 py-3 text-left">File</th>
                    <th className="px-6 py-3 text-left">Size</th>
                    <th className="px-6 py-3 text-left">Uploaded</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {materials.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-800">{m.title}</span>
                          {m.markingSchemeFilename && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium" title="Has marking scheme">📋</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-gray-500 truncate max-w-[160px]">{m.filename}</td>
                      <td className="px-6 py-3 text-gray-500">{formatFileSize(m.fileSize)}</td>
                      <td className="px-6 py-3 text-gray-500">{new Date(m.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {m.markingSchemeFilename ? (
                            <button onClick={() => handleDeleteMarkingScheme(m.id)}
                              className="text-purple-600 hover:text-purple-800 text-xs font-medium px-2 py-1 rounded-lg hover:bg-purple-50 transition" title="Remove marking scheme">
                              📋 ✕
                            </button>
                          ) : (
                            <label className="cursor-pointer text-purple-600 hover:text-purple-800 text-xs font-medium px-2 py-1 rounded-lg hover:bg-purple-50 transition" title="Upload marking scheme">
                              {msUploading === m.id ? '...' : '+ 📋'}
                              <input type="file" accept=".pdf" className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadMarkingScheme(m.id, f); e.target.value = ''; }} />
                            </label>
                          )}
                          <button onClick={() => handleDeleteMaterial(m.id)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MCQ TAB */}
      {tab === 'mcq' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Left: Create + Sets list (2/5) ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Create Set form */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <h3 className="font-bold text-gray-900 text-sm">Create MCQ Set</h3>
              <p className="text-xs text-gray-400">Questions live in the PDF. Create a set of answer slots linked to a paper.</p>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Set title *</label>
                <input type="text" value={newSetTitle} onChange={e => setNewSetTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 2023 A/L Paper — MCQ" />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Link to PDF paper</label>
                <select value={newSetMaterialId} onChange={e => setNewSetMaterialId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">— No specific paper —</option>
                  {materials.map(m => <option key={m.id} value={m.id}>📄 {m.title}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Number of questions</label>
                  <input type="number" min={1} max={200} value={newSetCount}
                    onChange={e => setNewSetCount(Math.max(1, Math.min(200, +e.target.value)))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Options (A–D or A–E)</label>
                  <div className="flex gap-2 mt-1">
                    {[4, 5].map(n => (
                      <button key={n} onClick={() => setNewSetOptions(n)}
                        className={`flex-1 py-2 text-sm rounded-xl border font-semibold transition ${newSetOptions === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={handleCreateAndGenerate} disabled={creatingSet || !newSetTitle.trim()}
                className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-60 text-sm">
                {creatingSet ? 'Creating...' : `⚡ Create & Generate ${newSetCount} Questions`}
              </button>
            </div>

            {/* Sets list */}
            <div className="bg-white rounded-2xl border border-gray-200">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 text-sm">MCQ Sets ({mcqSets.length})</h3>
              </div>
              {mcqSets.length === 0 ? (
                <div className="px-5 py-6 text-sm text-gray-400 text-center">No MCQ sets yet</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {mcqSets.map(s => {
                    const linkedPaper = materials.find(m => m.id === s.materialId);
                    return (
                      <li key={s.id}>
                        <button onClick={() => { setSelectedSet(s); setAnswerKeyInput(''); }}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition ${selectedSet?.id === s.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                          <p className="font-semibold text-gray-800 text-sm truncate">{s.title}</p>
                          {linkedPaper && <p className="text-xs text-blue-600 mt-0.5 truncate">📄 {linkedPaper.title}</p>}
                          <p className="text-xs text-gray-400 mt-0.5">{s.questions.length} questions · {s.optionCount ?? 4} options</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* ── Right: Set detail + answer grid (3/5) ── */}
          <div className="lg:col-span-3">
            {!selectedSet ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
                <div className="text-4xl mb-3">📝</div>
                <p className="text-sm">Select a set from the left to manage its answer key</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 flex flex-col">

                {/* Set header */}
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900">{selectedSet.title}</h3>
                      {(() => { const p = materials.find(m => m.id === selectedSet.materialId); return p ? <p className="text-xs text-blue-600 mt-0.5">📄 Linked to: {p.title}</p> : <p className="text-xs text-gray-400 mt-0.5">Not linked to any paper</p>; })()}
                      <p className="text-xs text-gray-500 mt-0.5">{selectedSet.questions.length} questions · {selectedSet.optionCount ?? 4} options (A–{selectedSet.optionCount >= 5 ? 'E' : 'D'})</p>
                    </div>
                    <button onClick={handleDeleteSet} disabled={deletingSet}
                      className="flex-shrink-0 text-xs text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-xl transition disabled:opacity-50">
                      {deletingSet ? '...' : '🗑 Delete Set'}
                    </button>
                  </div>
                </div>

                {/* Right panel tab switcher */}
                <div className="px-5 py-2 border-b border-gray-100 flex gap-1">
                  {(['answers', 'csv'] as const).map(t => (
                    <button key={t} onClick={() => setMcqRightTab(t)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${mcqRightTab === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                      {t === 'answers' ? '🗝 Answer Key' : '📥 CSV Import'}
                    </button>
                  ))}
                </div>

                {mcqRightTab === 'answers' && (
                  <>
                    {/* Paste answer key */}
                    <div className="px-5 py-3 border-b border-gray-100 bg-amber-50">
                      <p className="text-xs font-bold text-amber-800 mb-2">Paste Answer Key (fastest method)</p>
                      <p className="text-xs text-amber-600 mb-2">Type or paste all answers as a string, e.g. <span className="font-mono bg-amber-100 px-1 rounded">ABCDAECB...</span></p>
                      <div className="flex gap-2">
                        <input type="text" value={answerKeyInput} onChange={e => setAnswerKeyInput(e.target.value)}
                          placeholder={`${selectedSet.questions.length} answers, e.g. ABCDA...`}
                          className="flex-1 px-3 py-2 text-sm border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono" />
                        <button onClick={handleApplyAnswerKey} disabled={applyingKey || !answerKeyInput.trim()}
                          className="bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-amber-600 transition disabled:opacity-50">
                          {applyingKey ? 'Applying...' : 'Apply'}
                        </button>
                      </div>
                    </div>

                    {/* Answer grid */}
                    <div className="overflow-y-auto" style={{ maxHeight: '420px' }}>
                  {selectedSet.questions.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">No questions yet — use Add More Questions below</div>
                  ) : (
                    <div className="p-3 space-y-1">
                      {selectedSet.questions.map((q, i) => {
                        const opts = ['A', 'B', 'C', 'D', ...(( selectedSet.optionCount ?? 4) >= 5 ? ['E'] : [])];
                        return (
                          <div key={q.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 group">
                            <span className="text-xs font-bold text-gray-500 w-8 flex-shrink-0 text-right">Q{i + 1}</span>
                            <div className="flex gap-1 flex-1">
                              {opts.map(opt => (
                                <button key={opt} onClick={() => handleSetAnswer(q.id, opt)}
                                  className={`flex-1 text-xs font-bold py-1.5 rounded-lg border-2 transition-all
                                    ${q.answer === opt
                                      ? 'bg-green-500 text-white border-green-500 shadow-sm'
                                      : 'bg-white border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-600'}`}>
                                  {opt}
                                </button>
                              ))}
                            </div>
                            <button onClick={() => handleDeleteQuestion(q.id)}
                              className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 text-sm font-bold">
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                  </>
                )}

                {/* CSV Import tab */}
                {mcqRightTab === 'csv' && (
                  <div className="px-5 py-4 flex flex-col gap-3">
                    <div>
                      <p className="text-xs font-bold text-gray-700 mb-1">CSV Format</p>
                      <p className="text-xs text-gray-500 mb-2">One question per row: <span className="font-mono bg-gray-100 px-1 rounded">question,A,B,C,D,answer,explanation</span></p>
                      <p className="text-xs text-gray-400">For 5-option sets: <span className="font-mono bg-gray-100 px-1 rounded">question,A,B,C,D,E,answer,explanation</span></p>
                    </div>
                    <textarea
                      value={csvInput}
                      onChange={e => { setCsvInput(e.target.value); setCsvPreview(null); }}
                      rows={8}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-none"
                      placeholder={'What is H2O?,Water,Hydrogen,Oxygen,Acid,A,Common name for water\nSpeed of light?,3×10⁸,3×10⁶,3×10⁴,3×10²,A'} />
                    <div className="flex items-center gap-2">
                      <button onClick={handleCSVPreview} disabled={!csvInput.trim()}
                        className="px-4 py-2 text-sm font-semibold border border-gray-300 rounded-xl hover:bg-gray-50 transition disabled:opacity-50">
                        Preview
                      </button>
                      {csvPreview && (
                        <span className={`text-xs font-medium px-2 py-1 rounded-lg ${csvPreview.valid > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {csvPreview.valid} valid / {csvPreview.total} rows
                        </span>
                      )}
                      <button
                        onClick={handleCSVImport}
                        disabled={csvImporting || !csvInput.trim() || (csvPreview !== null && csvPreview.valid === 0)}
                        className="ml-auto bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
                        {csvImporting ? 'Importing...' : csvPreview ? `Import ${csvPreview.valid} Questions` : 'Import'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Add more questions (always visible) */}
                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                  <p className="text-xs font-bold text-gray-700 mb-2">Add More Questions</p>
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} max={200} value={addMoreCount}
                      onChange={e => setAddMoreCount(Math.max(1, Math.min(200, +e.target.value)))}
                      className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    <span className="text-xs text-gray-500">more questions</span>
                    <button onClick={handleAddMore} disabled={addMoreGenerating}
                      className="ml-auto bg-purple-600 text-white text-sm font-semibold px-4 py-1.5 rounded-xl hover:bg-purple-700 transition disabled:opacity-60">
                      {addMoreGenerating ? 'Adding...' : '⚡ Generate'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FLASH CARDS TAB */}
      {tab === 'flashcards' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-bold text-gray-900 mb-4">Add Flash Card</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question (Front)</label>
                <textarea value={newCard.question} onChange={(e) => setNewCard({...newCard, question: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3} placeholder="Question or concept" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Answer (Back)</label>
                <textarea value={newCard.answer} onChange={(e) => setNewCard({...newCard, answer: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3} placeholder="Answer or explanation" />
              </div>
            </div>
            <button onClick={handleAddCard}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition text-sm">
              Add Card
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Flash Cards ({flashCards.length})</h2>
            </div>
            {flashCards.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No flash cards yet</div>
            ) : (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {flashCards.map((c, i) => (
                  <div key={c.id} className="border border-gray-200 rounded-xl p-4 relative">
                    <span className="text-xs font-bold text-gray-400 mb-2 block">Card {i+1}</span>
                    <p className="text-sm font-medium text-gray-800">Q: {c.question}</p>
                    <p className="text-sm text-gray-600 mt-1">A: {c.answer}</p>
                    <button onClick={() => handleDeleteCard(c.id)}
                      className="absolute top-3 right-3 text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PERMISSIONS TAB */}
      {tab === 'permissions' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Download Permissions</h2>
            <p className="text-sm text-gray-500 mt-0.5">Grant students permission to download specific PDFs</p>
          </div>
          {materials.length === 0 || users.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {materials.length === 0 ? 'No materials uploaded yet' : 'No students registered yet'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-6 py-3 text-left sticky left-0 bg-gray-50">Student</th>
                    {materials.map((m) => (
                      <th key={m.id} className="px-4 py-3 text-center min-w-[120px]">
                        <span className="block truncate max-w-[120px]" title={m.title}>{m.title}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 sticky left-0 bg-white">
                        <p className="font-medium text-gray-800">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </td>
                      {materials.map((m) => {
                        const granted = hasPermission(u.id, m.id);
                        return (
                          <td key={m.id} className="px-4 py-3 text-center">
                            <button
                              onClick={() => granted ? handleRevokePermission(u.id, m.id) : handleGrantPermission(u.id, m.id)}
                              className={`w-8 h-8 rounded-lg text-lg transition ${granted ? 'bg-green-100 hover:bg-red-100' : 'bg-gray-100 hover:bg-green-100'}`}
                              title={granted ? 'Revoke permission' : 'Grant permission'}
                            >
                              {granted ? '✓' : '○'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
