'use client';
import { useState, useEffect } from 'react';

interface Props {
  section: string;
  total: number;
}

export function SectionProgressBadge({ section, total }: Props) {
  const [viewed, setViewed] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`lms-viewed-${section}`);
      if (raw) setViewed(JSON.parse(raw).length);
    } catch {}
  }, [section]);

  if (viewed === 0) return null;
  return (
    <span className="text-xs text-green-600 font-medium mt-0.5 block">
      {viewed}/{total} viewed
    </span>
  );
}
