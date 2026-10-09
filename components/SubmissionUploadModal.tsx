'use client';
import { useState, useRef } from 'react';
import { PaperSubmission } from '@/types';

interface Props {
  materialId: string;
  materialTitle: string;
  onClose: () => void;
  onSubmitted: (submission: PaperSubmission) => void;
}

export default function SubmissionUploadModal({ materialId, materialTitle, onClose, onSubmitted }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError('Please select a PDF file.'); return; }
    setUploading(true);
    setError('');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('materialId', materialId);

    try {
      const res = await fetch('/api/submissions', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Upload failed'); return; }
      onSubmitted(data);
      onClose();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 text-lg">Submit Answer Paper</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <p className="text-sm text-gray-600 mb-5">
          Upload your handwritten or digital answer sheet for<br />
          <span className="font-medium text-gray-800">{materialTitle}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => { setFile(e.target.files?.[0] ?? null); setError(''); }}
            />
            {file ? (
              <div className="space-y-1">
                <div className="text-2xl">📄</div>
                <p className="font-medium text-gray-800 text-sm truncate max-w-full">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-3xl text-gray-400">⬆</div>
                <p className="text-sm text-gray-600">Click to choose a PDF</p>
                <p className="text-xs text-gray-400">Your answer sheet — PDF only</p>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? 'Uploading…' : 'Submit Paper'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
