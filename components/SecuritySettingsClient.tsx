'use client';
import { useState, useEffect } from 'react';

interface SecurityConfig {
  id: string;
  screenshotGuard: boolean;
  tabBlur: boolean;
  screenCaptureBlock: boolean;
  printBlock: boolean;
  pdfWatermark: boolean;
  pdfPointerOverlay: boolean;
  concurrentSessionGuard: boolean;
}

const FEATURES: { key: keyof Omit<SecurityConfig, 'id' | 'updatedAt'>; label: string; desc: string }[] = [
  { key: 'screenshotGuard',        label: 'Screenshot Guard',       desc: 'Block right-click, F12, PrintScreen, Ctrl+P and dev-tool shortcuts' },
  { key: 'tabBlur',                label: 'Tab Blur',               desc: 'Blur PDF content when the browser tab or window loses focus' },
  { key: 'screenCaptureBlock',     label: 'Screen Capture Block',   desc: 'Block getDisplayMedia() API and flag capture attempts' },
  { key: 'printBlock',             label: 'Print Block',            desc: 'Hide all content via CSS when the browser print dialog opens' },
  { key: 'pdfWatermark',           label: 'PDF Watermark',          desc: 'Draw email address and session reference on every PDF page' },
  { key: 'pdfPointerOverlay',      label: 'PDF Pointer Overlay',    desc: 'Transparent overlay on PDF canvas that prevents direct interaction' },
  { key: 'concurrentSessionGuard', label: 'Session Guard',          desc: 'Detect and warn when the same material is open in multiple sessions' },
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${on ? 'bg-blue-600' : 'bg-gray-300'}`}
      role="switch"
      aria-checked={on}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

export default function SecuritySettingsClient() {
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/security-config')
      .then(r => r.json())
      .then(setConfig)
      .catch(() => setError('Failed to load security settings'));
  }, []);

  const toggle = async (key: keyof Omit<SecurityConfig, 'id' | 'updatedAt'>, value: boolean) => {
    if (!config) return;
    const prev = config[key];
    setConfig({ ...config, [key]: value });
    try {
      const res = await fetch('/api/admin/security-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error();
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 1500);
    } catch {
      setConfig({ ...config, [key]: prev });
      setError('Failed to save. Please try again.');
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 mb-6">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🔒</span>
          <h2 className="font-bold text-gray-900 text-sm">Security Feature Controls</h2>
        </div>
        <span className="text-xs text-gray-400">Changes apply on next page load</span>
      </div>

      {error && (
        <div className="mx-5 mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
      )}

      {!config ? (
        <div className="px-5 py-6 text-sm text-gray-400">Loading settings…</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {FEATURES.map(({ key, label, desc }) => (
            <li key={key} className="flex items-center justify-between px-5 py-3.5 gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  {label}
                  {savedKey === key && (
                    <span className="text-xs text-green-600 font-normal">✓ Saved</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
              <Toggle on={config[key] as boolean} onChange={(v) => toggle(key, v)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
