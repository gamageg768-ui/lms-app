'use client';
import { useState } from 'react';

interface TraceResult {
  sessionRef: string;
  user: { name: string; email: string };
  material: { title: string; subject: string; section: string };
  createdAt: string;
  ip: string | null;
}

export default function WatermarkTracePage() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<TraceResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const extractRef = (text: string): string | null => {
    // Watermark format: "email • ref:XXXXXXXX • date" or contains "ref:XXXXXXXX"
    const match = text.match(/ref:([a-f0-9]{8})/i);
    return match ? match[1] : null;
  };

  const handleTrace = async () => {
    setError('');
    setResults(null);
    const ref = extractRef(input.trim());
    if (!ref) {
      setError('No session reference found. Paste the full watermark text (it should contain "ref:XXXXXXXX").');
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/admin/access-logs?sessionRef=${ref}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Lookup failed'); return; }
    setResults(data.logs ?? []);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <a href="/admin/security" className="text-sm text-gray-400 hover:text-gray-700">← Security Dashboard</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Watermark Trace Tool</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste the watermark text from a leaked screenshot to identify the source student.
          Watermarks contain a unique session reference in the format <code className="bg-gray-100 px-1 rounded">ref:XXXXXXXX</code>.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Watermark text</label>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-none"
            placeholder="Paste watermark text here, e.g. student@example.com • ref:a1b2c3d4 • 14/06/2026"
          />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
        <button
          onClick={handleTrace}
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-60 text-sm"
        >
          {loading ? 'Tracing...' : 'Trace Source'}
        </button>
      </div>

      {results !== null && (
        <div className="mt-6 bg-white rounded-2xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 text-sm">
              {results.length === 0 ? 'No matching records found' : `Found ${results.length} matching session${results.length > 1 ? 's' : ''}`}
            </h2>
          </div>
          {results.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {results.map((r, i) => (
                <li key={i} className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold flex-shrink-0">
                      {r.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{r.user.name}</p>
                      <p className="text-sm text-gray-500">{r.user.email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Viewed <span className="font-medium text-gray-600">{r.material.title}</span> on{' '}
                        {new Date(r.createdAt).toLocaleString()}
                        {r.ip && <> from IP <span className="font-mono">{r.ip}</span></>}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
