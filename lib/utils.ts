import { SUBJECTS, SECTIONS, SubjectKey, SectionKey } from '@/types';
import path from 'path';

export function getSubjectLabel(key: string): string {
  return SUBJECTS.find((s) => s.key === key)?.label ?? key;
}

export function getSectionLabel(key: string): string {
  return SECTIONS.find((s) => s.key === key)?.label ?? key;
}

export function sectionHasMCQ(key: string): boolean {
  return SECTIONS.find((s) => s.key === key)?.hasMCQ ?? false;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function getUploadsDir(): string {
  return path.join(process.cwd(), 'uploads');
}

export function subjectColor(key: string): string {
  const map: Record<string, string> = {
    PURE_MATHS: 'blue',
    APPLIED_MATHS: 'indigo',
    PHYSICS: 'purple',
    CHEMISTRY: 'green',
    ZOOLOGY: 'orange',
    BOTANY: 'emerald',
  };
  return map[key] ?? 'gray';
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
