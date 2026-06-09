export type UserRole = 'ADMIN' | 'STUDENT';

export const SUBJECTS = [
  { key: 'PURE_MATHS', label: 'Pure Mathematics', icon: '∑', color: 'blue' },
  { key: 'APPLIED_MATHS', label: 'Applied Mathematics', icon: '∫', color: 'indigo' },
  { key: 'PHYSICS', label: 'Physics', icon: '⚛', color: 'purple' },
  { key: 'CHEMISTRY', label: 'Chemistry', icon: '⚗', color: 'green' },
  { key: 'ZOOLOGY', label: 'Zoology', icon: '🦠', color: 'orange' },
  { key: 'BOTANY', label: 'Botany', icon: '🌿', color: 'emerald' },
] as const;

export const SECTIONS = [
  { key: 'PAST_PAPERS', label: 'Past Papers', icon: '📄', hasMCQ: true },
  { key: 'MODEL_PAPERS', label: 'Model Papers', icon: '📋', hasMCQ: true },
  { key: 'SHORT_NOTES', label: 'Short Notes', icon: '📝', hasMCQ: false },
  { key: 'FLASH_CARDS', label: 'Flash Cards', icon: '🃏', hasMCQ: false },
  { key: 'THEORY', label: 'Theory', icon: '📚', hasMCQ: false },
] as const;

export type SubjectKey = typeof SUBJECTS[number]['key'];
export type SectionKey = typeof SECTIONS[number]['key'];

export interface Material {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  section: string;
  filename: string;
  fileSize: number;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
  hasDownloadPermission?: boolean;
  markingSchemePath?: string | null;
  markingSchemeFilename?: string | null;
  markingSchemeFileSize?: number | null;
}

export interface MCQQuestion {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE?: string | null;
  answer: string;
  explanation: string | null;
  order: number;
}

export interface MCQSet {
  id: string;
  title: string;
  subject: string;
  section: string;
  materialId: string | null;
  questionCount: number;
  optionCount: number;
  questions: MCQQuestion[];
}

export interface FlashCard {
  id: string;
  subject: string;
  question: string;
  answer: string;
  order: number;
}

export interface DownloadPermission {
  id: string;
  userId: string;
  materialId: string;
  grantedAt: string;
  user?: { name: string; email: string };
  material?: { title: string };
}
