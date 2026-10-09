'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { formatFileSize } from '@/lib/utils';

interface Material { id: string; title: string; description: string | null; subject: string; section: string; filename: string; fileSize: number; uploadedById: string; createdAt: string; updatedAt: string; markingSchemePath?: string | null; markingSchemeFilename?: string | null; markingSchemeFileSize?: number | null; expiresAt?: string | null; difficulty?: string | null; publishAt?: string | null; videoUrl?: string | null; }
interface LearningPathItem { id: string; pathId: string; materialId: string; order: number; material?: { id: string; title: string; filename: string } | null; }
interface LearningPath { id: string; title: string; description: string | null; subject: string; createdAt: string; updatedAt: string; items: LearningPathItem[]; }
interface MCQQuestion { id: string; mcqSetId: string; question: string; optionA: string; optionB: string; optionC: string; optionD: string; optionE: string | null; answer: string; explanation: string | null; order: number; }
interface MCQSet { id: string; title: string; subject: string; section: string; materialId: string | null; questionCount: number; optionCount: number; questions: MCQQuestion[]; createdAt: string; updatedAt: string; }
interface FlashCard { id: string; subject: string; question: string; answer: string; order: number; createdAt: string; updatedAt: string; }
interface User { id: string; name: string; email: string; }
interface Permission { id: string; userId: string; materialId: string; grantedAt: string; downloadLimit?: number; downloadCount?: number; }

interface Props {
  subjectKey: string; sectionKey: string; subjectLabel: string; sectionLabel: string;
  hasMCQ?: boolean; materials: Material[]; mcqSets: MCQSet[]; flashCards: FlashCard[];
  users?: User[]; permissions?: Permission[]; learningPaths?: LearningPath[]; backHref: string;
}

type Tab = 'materials' | 'mcq' | 'flashcards' | 'permissions' | 'learningpaths';

export default function AdminSectionClient({
  subjectKey, sectionKey, subjectLabel, sectionLabel,
  hasMCQ, materials: initMaterials, mcqSets: initMCQSets,
  flashCards: initFlashCards, users = [], permissions: initPerms = [],
  learningPaths: initPaths = [], backHref,
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

  // Feature 5: Expiry date editing state
  const [expiryEditing, setExpiryEditing] = useState<string | null>(null);
  const [expiryValue, setExpiryValue] = useState('');

  // Feature 3: Difficulty editing state
  const [difficultyEditing, setDifficultyEditing] = useState<string | null>(null);

  // Feature 7: Publish-at editing state
  const [publishEditing, setPublishEditing] = useState<string | null>(null);
  const [publishValue, setPublishValue] = useState('');

  // Video URL editing state
  const [videoEditing, setVideoEditing] = useState<string | null>(null);
  const [videoValue, setVideoValue] = useState('');

  // Feature 2: Learning paths state
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>(initPaths);
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);
  const [newPathTitle, setNewPathTitle] = useState('');
  const [newPathDesc, setNewPathDesc] = useState('');
  const [creatingPath, setCreatingPath] = useState(false);
  const [pathAddMaterialId, setPathAddMaterialId] = useState('');
  const [pathAddingMat, setPathAddingMat] = useState(false);

  // Feature 12: AI difficulty tagger state
  const [aiTagging, setAiTagging] = useState(false);
  const [aiTagPreview, setAiTagPreview] = useState<{ id: string; question: string; difficulty: string }[] | null>(null);
  const [aiTagApplying, setAiTagApplying] = useState(false);
  const [aiTagApplied, setAiTagApplied] = useState(false);

  const handleSetExpiry = async (materialId: string, expiresAt: string | null) => {
    const res = await fetch(`/api/materials/${materialId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresAt }),
    });
    if (res.ok) setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, expiresAt } : m));
    setExpiryEditing(null);
    setExpiryValue('');
  };

  const handleSetDifficulty = async (materialId: string, difficulty: string | null) => {
    const res = await fetch(`/api/materials/${materialId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty }),
    });
    if (res.ok) setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, difficulty } : m));
    setDifficultyEditing(null);
  };

  const handleSetPublishAt = async (materialId: string, publishAt: string | null) => {
    const res = await fetch(`/api/materials/${materialId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publishAt }),
    });
    if (res.ok) setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, publishAt } : m));
    setPublishEditing(null);
    setPublishValue('');
  };

  const handleSetVideoUrl = async (materialId: string, videoUrl: string | null) => {
    const res = await fetch(`/api/materials/${materialId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl }),
    });
    if (res.ok) setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, videoUrl } : m));
    setVideoEditing(null);
    setVideoValue('');
  };

  const handleCreatePath = async () => {
    if (!newPathTitle.trim()) return;
    setCreatingPath(true);
    const res = await fetch('/api/learning-paths', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newPathTitle, description: newPathDesc || null, subject: subjectKey }),
    });
    const data = await res.json();
    setCreatingPath(false);
    if (res.ok) {
      const newPath = { ...data, items: [] };
      setLearningPaths(prev => [newPath, ...prev]);
      setSelectedPath(newPath);
      setNewPathTitle('');
      setNewPathDesc('');
    }
  };

  const handleDeletePath = async (pathId: string) => {
    if (!confirm('Delete this learning path?')) return;
    const res = await fetch(`/api/learning-paths/${pathId}`, { method: 'DELETE' });
    if (res.ok) {
      setLearningPaths(prev => prev.filter(p => p.id !== pathId));
      if (selectedPath?.id === pathId) setSelectedPath(null);
    }
  };

  const handleAddToPath = async () => {
    if (!selectedPath || !pathAddMaterialId) return;
    setPathAddingMat(true);
    const res = await fetch(`/api/learning-paths/${selectedPath.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materialId: pathAddMaterialId }),
    });
    const data = await res.json();
    setPathAddingMat(false);
    if (res.ok) {
      const mat = materials.find(m => m.id === pathAddMaterialId);
      const newItem: LearningPathItem = { ...data, material: mat ? { id: mat.id, title: mat.title, filename: mat.filename } : null };
      const updated = { ...selectedPath, items: [...selectedPath.items, newItem] };
      setSelectedPath(updated);
      setLearningPaths(prev => prev.map(p => p.id === selectedPath.id ? updated : p));
      setPathAddMaterialId('');
    }
  };

  const handleRemoveFromPath = async (pathId: string, itemId: string) => {
    const res = await fetch(`/api/learning-paths/${pathId}/items/${itemId}`, { method: 'DELETE' });
    if (res.ok && selectedPath) {
      const updated = { ...selectedPath, items: selectedPath.items.filter(i => i.id !== itemId) };
      setSelectedPath(updated);
      setLearningPaths(prev => prev.map(p => p.id === pathId ? updated : p));
    }
  };

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

  const handleAiTagDifficulty = async () => {
    if (flashCards.length === 0) return;
    setAiTagging(true);
    setAiTagPreview(null);
    try {
      const res = await fetch('/api/ai/tag-card-difficulty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: flashCards.slice(0, 50) }),
      });
      if (!res.ok) { alert('AI tagging failed. Check GROQ_API_KEY.'); return; }
      const data = await res.json();
      const preview = (data.ratings ?? []).map((r: { id: string; difficulty: string }) => {
        const card = flashCards.find(c => c.id === r.id);
        return { id: r.id, question: card?.question ?? '', difficulty: r.difficulty };
      });
      setAiTagPreview(preview);
    } finally {
      setAiTagging(false);
    }
  };

  const handleApplyAiTags = async () => {
    if (!aiTagPreview) return;
    setAiTagApplying(true);
    // Store AI difficulty tags in localStorage (client-side, admin-side only)
    // We store a map subject → { cardId: difficulty }
    const storageKey = `lms-admin-card-difficulty-${subjectKey}`;
    const existing: Record<string, string> = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    for (const r of aiTagPreview) existing[r.id] = r.difficulty;
    localStorage.setItem(storageKey, JSON.stringify(existing));
    setAiTagPreview(null);
    setAiTagApplying(false);
    setAiTagApplied(true);
    setTimeout(() => setAiTagApplied(false), 4000);
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
    ...(sectionKey !== 'FLASH_CARDS' ? [{ key: 'learningpaths', label: '📚 Paths', count: learningPaths.length }] : []),
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
                    <th className="px-4 py-3 text-left">Level</th>
                    <th className="px-4 py-3 text-left">Publishes</th>
                    <th className="px-6 py-3 text-left">Size</th>
                    <th className="px-6 py-3 text-left">Uploaded</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {materials.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50 group">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-800">{m.title}</span>
                          {m.markingSchemeFilename && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium" title="Has marking scheme">📋</span>
                          )}
                          {/* Feature 5: expiry badge */}
                          {expiryEditing === m.id ? (
                            <span className="flex items-center gap-1">
                              <input type="date" value={expiryValue} onChange={e => setExpiryValue(e.target.value)}
                                className="text-xs border border-amber-400 rounded px-1 py-0.5 focus:outline-none" />
                              <button onClick={() => handleSetExpiry(m.id, expiryValue || null)}
                                className="text-xs font-semibold text-green-700 hover:text-green-900">✓</button>
                              <button onClick={() => { setExpiryEditing(null); setExpiryValue(''); }}
                                className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                            </span>
                          ) : m.expiresAt ? (
                            <button onClick={() => { setExpiryEditing(m.id); setExpiryValue(m.expiresAt!.slice(0, 10)); }}
                              title="Click to change expiry"
                              className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium hover:bg-amber-200 transition">
                              ⏳ {new Date(m.expiresAt).toLocaleDateString()}
                            </button>
                          ) : (
                            <button onClick={() => setExpiryEditing(m.id)}
                              title="Set expiry date"
                              className="text-xs text-gray-400 hover:text-amber-600 px-1 rounded transition opacity-0 group-hover:opacity-100">
                              + expiry
                            </button>
                          )}
                        </div>
                      </td>
                      {/* Feature 3: Difficulty cell */}
                      <td className="px-4 py-3">
                        {difficultyEditing === m.id ? (
                          <select autoFocus onBlur={() => setDifficultyEditing(null)}
                            onChange={e => handleSetDifficulty(m.id, e.target.value || null)}
                            defaultValue={m.difficulty || ''}
                            className="text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none">
                            <option value="">—</option>
                            <option value="BEGINNER">Beginner</option>
                            <option value="INTERMEDIATE">Intermediate</option>
                            <option value="ADVANCED">Advanced</option>
                          </select>
                        ) : (
                          <button onClick={() => setDifficultyEditing(m.id)}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium transition hover:opacity-80 ${
                              m.difficulty === 'BEGINNER' ? 'bg-green-100 text-green-700' :
                              m.difficulty === 'INTERMEDIATE' ? 'bg-yellow-100 text-yellow-700' :
                              m.difficulty === 'ADVANCED' ? 'bg-red-100 text-red-700' :
                              'text-gray-400 hover:text-blue-600'}`}>
                            {m.difficulty ? m.difficulty.charAt(0) + m.difficulty.slice(1).toLowerCase() : '+ level'}
                          </button>
                        )}
                      </td>
                      {/* Feature 7: Publish-at cell */}
                      <td className="px-4 py-3">
                        {publishEditing === m.id ? (
                          <span className="flex items-center gap-1">
                            <input type="datetime-local" value={publishValue} onChange={e => setPublishValue(e.target.value)}
                              className="text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none" />
                            <button onClick={() => handleSetPublishAt(m.id, publishValue ? new Date(publishValue).toISOString() : null)}
                              className="text-xs font-semibold text-green-700 hover:text-green-900">✓</button>
                            <button onClick={() => { setPublishEditing(null); setPublishValue(''); }}
                              className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                          </span>
                        ) : m.publishAt ? (
                          <button onClick={() => { setPublishEditing(m.id); setPublishValue(m.publishAt!.slice(0, 16)); }}
                            className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium hover:bg-blue-200 transition">
                            ⏰ {new Date(m.publishAt).toLocaleDateString()}
                          </button>
                        ) : (
                          <button onClick={() => setPublishEditing(m.id)}
                            className="text-xs text-gray-400 hover:text-blue-600 px-1 rounded transition opacity-0 group-hover:opacity-100">
                            + schedule
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-3 text-gray-500">{formatFileSize(m.fileSize)}</td>
                      <td className="px-6 py-3 text-gray-500">{new Date(m.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {/* Video URL button */}
                          {videoEditing === m.id ? (
                            <span className="flex items-center gap-1">
                              <input type="url" value={videoValue} onChange={e => setVideoValue(e.target.value)}
                                placeholder="YouTube or MP4 URL"
                                className="text-xs border border-indigo-300 rounded px-1 py-0.5 focus:outline-none w-40" />
                              <button onClick={() => handleSetVideoUrl(m.id, videoValue || null)}
                                className="text-xs font-semibold text-green-700 hover:text-green-900">✓</button>
                              <button onClick={() => { setVideoEditing(null); setVideoValue(''); }}
                                className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                            </span>
                          ) : m.videoUrl ? (
                            <button onClick={() => { setVideoEditing(m.id); setVideoValue(m.videoUrl!); }}
                              className="text-indigo-600 hover:text-indigo-800 text-xs font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 transition" title="Edit video URL">
                              🎬 ✓
                            </button>
                          ) : (
                            <button onClick={() => setVideoEditing(m.id)}
                              className="text-indigo-400 hover:text-indigo-700 text-xs font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 transition" title="Add video URL">
                              + 🎬
                            </button>
                          )}
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
                            {/* Feature 10: canary badge — stored as [CANARY] prefix in explanation */}
                            {q.explanation?.startsWith('[CANARY]') && (
                              <span title="Canary question — for leak tracing" className="text-xs flex-shrink-0">🐦</span>
                            )}
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
                            {/* Feature 10: canary toggle button */}
                            <button
                              onClick={async () => {
                                if (!selectedSet) return;
                                const isCanary = q.explanation?.startsWith('[CANARY]');
                                const newExplanation = isCanary
                                  ? (q.explanation?.slice('[CANARY]'.length).trim() || null)
                                  : '[CANARY]' + (q.explanation ? ' ' + q.explanation : '');
                                await fetch(`/api/mcq/sets/${selectedSet.id}/questions/${q.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ explanation: newExplanation }),
                                });
                                syncSet({ ...selectedSet, questions: selectedSet.questions.map(sq => sq.id === q.id ? { ...sq, explanation: newExplanation } : sq) });
                              }}
                              title={q.explanation?.startsWith('[CANARY]') ? 'Remove canary flag' : 'Mark as canary (leak-tracing question)'}
                              className={`flex-shrink-0 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg transition-all text-sm
                                ${q.explanation?.startsWith('[CANARY]') ? 'opacity-100 bg-yellow-100' : 'hover:bg-yellow-50'}`}>
                              🐦
                            </button>
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
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">Flash Cards ({flashCards.length})</h2>
                {aiTagApplied && <p className="text-xs text-purple-600 mt-0.5">✓ Difficulty tags saved — students will see these in the viewer</p>}
              </div>
              {flashCards.length > 0 && (
                <button onClick={handleAiTagDifficulty} disabled={aiTagging}
                  className="flex items-center gap-1.5 bg-purple-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-purple-700 transition disabled:opacity-60">
                  {aiTagging ? 'Analysing...' : '✨ Tag Difficulty'}
                </button>
              )}
            </div>

            {/* AI difficulty tag preview */}
            {aiTagPreview && (
              <div className="border-b border-gray-100 bg-purple-50 p-4">
                <p className="text-sm font-semibold text-purple-800 mb-3">AI Difficulty Suggestions — review and apply:</p>
                <div className="overflow-x-auto max-h-60 overflow-y-auto rounded-xl border border-purple-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-purple-50 text-xs text-purple-700 uppercase sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">Question</th>
                        <th className="px-4 py-2 text-center">AI Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {aiTagPreview.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-2 text-gray-700 truncate max-w-xs">{r.question}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              r.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                              r.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>{r.difficulty}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleApplyAiTags} disabled={aiTagApplying}
                    className="bg-purple-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-60">
                    {aiTagApplying ? 'Saving...' : 'Apply Tags'}
                  </button>
                  <button onClick={() => setAiTagPreview(null)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                    Dismiss
                  </button>
                </div>
              </div>
            )}

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
                        const perm = permissions.find(p => p.userId === u.id && p.materialId === m.id);
                        return (
                          <td key={m.id} className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <button
                                onClick={() => granted ? handleRevokePermission(u.id, m.id) : handleGrantPermission(u.id, m.id)}
                                className={`w-8 h-8 rounded-lg text-lg transition ${granted ? 'bg-green-100 hover:bg-red-100' : 'bg-gray-100 hover:bg-green-100'}`}
                                title={granted ? 'Revoke permission' : 'Grant permission'}
                              >
                                {granted ? '✓' : '○'}
                              </button>
                              {/* Feature 8: show download count/limit */}
                              {perm && (
                                <span className="text-[10px] text-gray-400 leading-tight">
                                  {perm.downloadCount ?? 0}/{perm.downloadLimit ?? 3}
                                </span>
                              )}
                            </div>
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

      {/* LEARNING PATHS TAB */}
      {tab === 'learningpaths' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Create + list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <h3 className="font-bold text-gray-900 text-sm">Create Learning Path</h3>
              <input type="text" value={newPathTitle} onChange={e => setNewPathTitle(e.target.value)}
                placeholder="Path title, e.g. Exam Prep Sequence"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <textarea value={newPathDesc} onChange={e => setNewPathDesc(e.target.value)}
                placeholder="Optional description"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              <button onClick={handleCreatePath} disabled={creatingPath || !newPathTitle.trim()}
                className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-60 text-sm">
                {creatingPath ? 'Creating...' : '+ Create Path'}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 text-sm">Learning Paths ({learningPaths.length})</h3>
              </div>
              {learningPaths.length === 0 ? (
                <div className="px-5 py-6 text-sm text-gray-400 text-center">No paths yet</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {learningPaths.map(p => (
                    <li key={p.id}>
                      <button onClick={() => setSelectedPath(p)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition ${selectedPath?.id === p.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                        <p className="font-semibold text-gray-800 text-sm truncate">{p.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{p.items.length} materials</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right: Path detail */}
          <div className="lg:col-span-3">
            {!selectedPath ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
                <div className="text-4xl mb-3">📚</div>
                <p className="text-sm">Select a path to manage its materials</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200">
                <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedPath.title}</h3>
                    {selectedPath.description && <p className="text-xs text-gray-500 mt-0.5">{selectedPath.description}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{selectedPath.items.length} materials in sequence</p>
                  </div>
                  <button onClick={() => handleDeletePath(selectedPath.id)}
                    className="flex-shrink-0 text-xs text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-xl transition">
                    🗑 Delete
                  </button>
                </div>

                {/* Add material to path */}
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex gap-2 items-center">
                  <select value={pathAddMaterialId} onChange={e => setPathAddMaterialId(e.target.value)}
                    className="flex-1 text-sm px-2 py-1.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">— Add material to path —</option>
                    {materials.filter(m => !selectedPath.items.some(i => i.materialId === m.id)).map(m => (
                      <option key={m.id} value={m.id}>📄 {m.title}</option>
                    ))}
                  </select>
                  <button onClick={handleAddToPath} disabled={pathAddingMat || !pathAddMaterialId}
                    className="flex-shrink-0 bg-blue-600 text-white text-sm px-3 py-1.5 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50">
                    {pathAddingMat ? '...' : '+ Add'}
                  </button>
                </div>

                {/* Items list */}
                {selectedPath.items.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">No materials in this path yet</div>
                ) : (
                  <ol className="divide-y divide-gray-100">
                    {selectedPath.items.map((item, idx) => {
                      const mat = item.material ?? materials.find(m => m.id === item.materialId);
                      return (
                        <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                          <span className="text-sm font-bold text-gray-400 w-6 text-right flex-shrink-0">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{mat?.title ?? 'Unknown'}</p>
                          </div>
                          <button onClick={() => handleRemoveFromPath(selectedPath.id, item.id)}
                            className="flex-shrink-0 text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded-lg hover:bg-red-50 transition">
                            ✕
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
