# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # prisma generate + db push + next build
npm run lint         # ESLint check

npm run db:push      # Sync Prisma schema → SQLite (run after schema changes)
npm run db:studio    # Open Prisma Studio GUI
npm run db:seed      # Seed database from prisma/seed.ts

# Prisma CLI requires DATABASE_URL set explicitly in PowerShell:
$env:DATABASE_URL="file:./dev.db"; npx prisma db push
```

**Guest admin account** (pre-seeded via `scripts/create-guest-admin.js`):
- Email: `guest@admin.com` / Password: `guest1234`

---

## Architecture

### Route Groups
Three Next.js route groups, each with its own layout and auth guard:

- `app/(auth)/` — public (login, register)
- `app/(student)/` — requires `role === 'STUDENT'`; wraps with `StudentNavbar` + `ScreenshotGuard`
- `app/(admin)/` — requires `role === 'ADMIN'`; wraps with `AdminSidebar` + `ScreenshotGuard`

Role enforcement in two places: `middleware.ts` (edge redirect) and each layout (server-side `auth()` check). Both must agree.

### Auth
NextAuth v5 (beta), JWT strategy, Credentials provider. `lib/auth.ts` exports `{ handlers, signIn, signOut, auth }`. Use `auth()` directly in Server Components and API routes — there is no `getServerSession`. JWT callback attaches `id` and `role`; session callback re-exposes them on `session.user`.

### Data Flow
All data fetching in Server Components (`page.tsx`). They query Prisma directly, convert `Date` → ISO strings, then pass serializable props to Client Components. Client Components are `*Client.tsx` with `'use client'`. No Client Component fetches on mount except for PDF serving.

### Subject × Section Matrix

| Subject key | Label |
|-------------|-------|
| `PURE_MATHS` | Pure Mathematics (∑, blue) |
| `APPLIED_MATHS` | Applied Mathematics (∫, indigo) |
| `PHYSICS` | Physics (⚛, purple) |
| `CHEMISTRY` | Chemistry (⚗, green) |
| `ZOOLOGY` | Zoology (🦠, orange) |
| `BOTANY` | Botany (🌿, emerald) |

| Section key | Label | hasMCQ | Route segment |
|-------------|-------|--------|---------------|
| `PAST_PAPERS` | Past Papers 📄 | ✓ | `/past-papers` |
| `MODEL_PAPERS` | Model Papers 📋 | ✓ | `/model-papers` |
| `SHORT_NOTES` | Short Notes 📝 | ✗ | `/short-notes` |
| `FLASH_CARDS` | Flash Cards 🃏 | ✗ | `/flash-cards` |
| `THEORY` | Theory 📚 | ✗ | `/theory` |

`SUBJECTS` and `SECTIONS` in `types/index.ts` are the single source of truth. Never hardcode these strings.

### File Storage
PDFs: `uploads/{subject}/{section}/{timestamp}-{filename}`. Path stored in `Material.filePath`.  
Marking schemes: `uploads/{subject}/{section}/ms-{timestamp}-{filename}`. Path stored in `Material.markingSchemePath`.  
`/api/materials/[id]/serve` — inline (no download header).  
`/api/materials/[id]/download` — forced download, requires `DownloadPermission` (admins bypass).

### PDF Rendering
`PDFViewer.tsx` dynamically imports `pdfjs-dist` inside `useEffect`. Worker at `public/pdf.worker.min.js`. `next.config.js` aliases `canvas → false` and `encoding → false`. Renders to HTML5 canvas; watermark drawn on top post-render.

### Security Layer
`ScreenshotGuard.tsx` blocks: right-click, `Ctrl+P`, `PrintScreen`, `F12`, dev-tool shortcuts, `Win+Shift+S`. `globals.css` disables `user-select` and hides content via `@media print`. PDF canvas has an overlay `div` (`pdf-protected::after`) intercepting pointer events.

---

## Component Reference

### `components/MCQPanel.tsx`
Full-featured MCQ testing panel. Rendered inside `MaterialViewerClient` for sections with `hasMCQ: true`.

**Props:**
```ts
questions: MCQQuestion[]
setId: string
setTitle: string
optionCount: number          // 4 or 5
hasMarkingScheme?: boolean
onViewMarkingScheme?: () => void
```

**Key state:**
- `answers: Record<string, string>` — selected option per question ID
- `submitted: boolean` — true after final submit
- `currentIdx: number` — active question index
- `shuffled: MCQQuestion[]` — shuffled or original order
- `shuffle: boolean` — toggle shuffle mode
- `flagged: Set<string>` — flagged question IDs
- `timerMode: 0|30|60|90` — seconds per question (0 = off)
- `timeLeft: number` — remaining seconds
- `history: {score,total,timeTaken,date}[]` — last 5 attempts
- `showHistory: boolean` — history panel open
- `instantFeedback: boolean` — lock-on-select mode
- `lockedIds: Set<string>` — questions answered in instant feedback mode
- `expandedId: string|null` — explanation row expanded after submit
- `showHelp: boolean` — keyboard shortcut modal

**localStorage:** `lms-mcq-history-{setId}` → `{score,total,timeTaken,date}[]` (last 5)

**Keyboard shortcuts:** `a-e` select option, `↑↓/j/k` navigate, `f` flag, `s` submit, `r` reset, `?` help modal, `Esc` close help

---

### `components/PDFViewer.tsx`
PDF viewer with zoom, page nav, dark mode, two-page spread, reading progress restore, watermark.

**Props:**
```ts
src: string          // URL e.g. /api/materials/{id}/serve
materialId: string   // used for localStorage progress key
filename: string     // shown in toolbar
```

**Key state:**
- `currentPage, numPages, scale`
- `darkMode: boolean` — CSS `filter: invert(1) hue-rotate(180deg)` on canvas wrapper
- `twoPage: boolean` — renders two canvases side-by-side; Prev/Next step by 2
- `resumePage: number|null` — banner "Resume from page N?" shown until dismissed or user navigates

**localStorage:**
- `lms-pdf-darkmode` → `"0"` or `"1"` (persists across sessions)
- `lms-pdf-progress-{materialId}` → `{page: number, total: number}` (saved on every page change)

---

### `components/MaterialViewerClient.tsx`
Left sidebar (material list) + right panel (PDF viewer or MCQ panel). The main student content page for each section.

**Props:**
```ts
materials: Material[]
mcqSets: MCQSet[]
subject: string
section: string
```

**Key state:**
- `selectedMaterial: Material|null`
- `viewMode: 'paper'|'marking'` — tab toggle when material has marking scheme
- `bookmarked: Set<string>` — bookmarked material IDs
- `bookmarkFilter: 'all'|'starred'`
- `savedPages: Record<string, number>` — `{materialId: page}` loaded from localStorage on mount
- `search, sortBy, sidebarOpen` — sidebar controls

**localStorage:**
- `lms-bookmarks` → `string[]` (material IDs)
- `lms-pdf-progress-{materialId}` → read-only here (write is in PDFViewer)
- `lms-viewed-{section}` → `string[]` (material IDs marked viewed; updated when user opens a material)

Passes `hasMarkingScheme={!!selectedMaterial?.markingSchemeFilename}` and `onViewMarkingScheme` to `MCQPanel`.

---

### `components/FlashCardPage.tsx`
3D flip card study interface with mastery tracking.

**Props:**
```ts
cards: (FlashCard & { createdAt: string; updatedAt: string })[]
subjectLabel: string
backHref: string
subject: string   // used as localStorage mastery key
```

**Key state:**
- `cardIndex: number` — current card in filtered deck
- `flipped: boolean` — front (question) vs back (answer); CSS `rotateY(180deg)`
- `ratings: Record<string, 'easy'|'medium'|'hard'>` — per-card rating this session
- `mastery: {easy:string[],medium:string[],hard:string[]}` — persisted mastery
- `filter: 'all'|'new'|'weak'` — deck filter

**localStorage:** `lms-flashcard-mastery-{subject}` → `{easy:string[],medium:string[],hard:string[]}`

**Layout:** Filter bar → mastery summary bar → card with flip animation → rating buttons (Easy/Medium/Hard)

---

### `components/AdminSectionClient.tsx`
Full admin management panel. Four tabs: Materials | MCQ Sets | Flash Cards | Permissions.

**Props:** materials, mcqSets (with questions), flashCards, permissions (with user+material), users, subject, section (all passed from Server Component page).

**Materials tab:** Upload form (title, description, PDF file, optional marking scheme PDF), materials table with per-row delete/edit/upload-marking-scheme/remove-marking-scheme actions.

**MCQ Sets tab:** Set list (left) + set editor (right). Right panel has two sub-tabs: `🗝 Answer Key` and `📥 CSV Import`. Answer key: bulk generate stubs → paste answer string → apply. CSV import: paste CSV → preview (valid/total count) → import.

**Flash Cards tab:** Add/edit/delete flash cards with order field.

**Permissions tab:** Grant/revoke download permissions per student per material.

---

### `components/SectionProgressBadge.tsx`
Client component rendered in the server-rendered subject page. Shows "X/N viewed" in green.

**Props:** `section: string`, `total: number`  
**localStorage:** `lms-viewed-{section}` → `string[]` (reads length on mount)  
Returns `null` if viewed count is 0.

---

### Layout Components
- `components/StudentNavbar.tsx` — top nav with subject links and user menu
- `components/AdminSidebar.tsx` — left sidebar with subject/section navigation
- `components/ScreenshotGuard.tsx` — mounts in both layouts; no props; event-listener only

---

## API Routes Reference

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/api/auth/[...nextauth]` | — | NextAuth handlers |
| GET | `/api/me` | any | Current user info |
| GET | `/api/users` | admin | List all students |
| POST | `/api/users` | — | Register new student |
| GET | `/api/users/[id]` | admin | User + permissions |
| DELETE | `/api/users/[id]` | admin | Delete student |
| GET | `/api/materials` | any | List materials (subject+section filter) |
| POST | `/api/materials` | admin | Upload PDF (multipart; optional `markingSchemeFile`) |
| PATCH | `/api/materials/[id]` | admin | Update title/description |
| DELETE | `/api/materials/[id]` | admin | Delete material + file(s) from disk |
| GET | `/api/materials/[id]/serve` | student | Serve PDF inline (no download) |
| GET | `/api/materials/[id]/download` | student+perm | Forced download (requires DownloadPermission) |
| GET | `/api/materials/[id]/marking-scheme` | student | Serve marking scheme PDF inline |
| POST | `/api/materials/[id]/marking-scheme` | admin | Upload/replace marking scheme |
| DELETE | `/api/materials/[id]/marking-scheme` | admin | Remove marking scheme |
| GET | `/api/mcq/sets` | any | List MCQ sets (subject+section filter) |
| POST | `/api/mcq/sets` | admin | Create MCQ set |
| GET | `/api/mcq/sets/[id]` | any | Set + all questions |
| PATCH | `/api/mcq/sets/[id]` | admin | Update set metadata |
| DELETE | `/api/mcq/sets/[id]` | admin | Delete set + questions |
| GET | `/api/mcq/sets/[id]/questions` | any | List questions |
| POST | `/api/mcq/sets/[id]/questions` | admin | Add single question |
| PATCH | `/api/mcq/sets/[id]/questions/[qid]` | admin | Update question |
| DELETE | `/api/mcq/sets/[id]/questions/[qid]` | admin | Delete question |
| POST | `/api/mcq/sets/[id]/questions/bulk` | admin | Generate question stubs |
| PATCH | `/api/mcq/sets/[id]/questions/bulk` | admin | Apply answer key string |
| POST | `/api/mcq/sets/[id]/questions/import` | admin | Bulk import from CSV body |
| GET | `/api/flashcards` | any | List flash cards (subject filter) |
| POST | `/api/flashcards` | admin | Create flash card |
| PATCH | `/api/flashcards/[id]` | admin | Update flash card |
| DELETE | `/api/flashcards/[id]` | admin | Delete flash card |
| GET | `/api/permissions` | admin | List permissions (userId/materialId filter) |
| POST | `/api/permissions` | admin | Grant download permission |
| DELETE | `/api/permissions` | admin | Revoke download permission |

---

## localStorage Keys Reference

| Key | Value shape | Read by | Written by |
|-----|-------------|---------|------------|
| `lms-viewed-{SECTION_KEY}` | `string[]` (material IDs) | SectionProgressBadge | MaterialViewerClient |
| `lms-pdf-darkmode` | `"0"` or `"1"` | PDFViewer (init) | PDFViewer |
| `lms-pdf-progress-{MATERIAL_ID}` | `{page:number, total:number}` | PDFViewer (resume banner), MaterialViewerClient (↩ badge) | PDFViewer |
| `lms-bookmarks` | `string[]` (material IDs) | MaterialViewerClient | MaterialViewerClient |
| `lms-mcq-history-{SET_ID}` | `{score,total,timeTaken,date}[]` max 5 | MCQPanel | MCQPanel |
| `lms-flashcard-mastery-{SUBJECT_KEY}` | `{easy:string[],medium:string[],hard:string[]}` | FlashCardPage | FlashCardPage |

---

## Prisma Schema Summary

**User** — `id, email(unique), name, password(bcrypt), role(default STUDENT), createdAt, updatedAt`  
→ has many `DownloadPermission`

**Material** — `id, title, description?, subject, section, filename, filePath, fileSize, markingSchemePath?, markingSchemeFilename?, markingSchemeFileSize?, uploadedById, createdAt, updatedAt`  
→ has many `DownloadPermission`, has many `MCQSet`

**DownloadPermission** — `id, userId, materialId, grantedAt` (unique on userId+materialId)  
→ belongs to `User`, belongs to `Material`

**FlashCard** — `id, subject, question, answer, order, createdAt, updatedAt`

**MCQSet** — `id, title, subject, section, materialId?(→Material), questionCount(default 0), optionCount(4|5), createdAt, updatedAt`  
→ has many `MCQQuestion`

**MCQQuestion** — `id, mcqSetId(→MCQSet cascade delete), question, optionA, optionB, optionC, optionD, optionE?, answer(A-E), explanation?, order, createdAt`

---

## Types Reference (`types/index.ts`)

```ts
export type UserRole = 'ADMIN' | 'STUDENT';
export type SubjectKey = 'PURE_MATHS'|'APPLIED_MATHS'|'PHYSICS'|'CHEMISTRY'|'ZOOLOGY'|'BOTANY';
export type SectionKey = 'PAST_PAPERS'|'MODEL_PAPERS'|'SHORT_NOTES'|'FLASH_CARDS'|'THEORY';

interface Material {
  id, title, description?, subject, section, filename, fileSize, uploadedById, createdAt, updatedAt
  hasDownloadPermission?: boolean
  markingSchemePath?, markingSchemeFilename?, markingSchemeFileSize?
}
interface MCQQuestion { id, question, optionA-D, optionE?, answer, explanation?, order }
interface MCQSet { id, title, subject, section, materialId?, questionCount, optionCount, questions[] }
interface FlashCard { id, subject, question, answer, order }
interface DownloadPermission { id, userId, materialId, grantedAt, user?{name,email}, material?{title} }
```

---

## Key Patterns

**Adding a new API route:** Call `auth()` at the top, check `session.user.role` if needed. Return `NextResponse.json(...)`.

**DB access:** Import `{ prisma }` from `@/lib/db`. Never instantiate `PrismaClient` directly.

**`@/` path alias** maps to the repo root (`tsconfig.json`).

**No icon library** — use inline SVG or Unicode glyphs throughout.

**`any` is allowed** by ESLint (`@typescript-eslint/no-explicit-any: off`). Prefer typed interfaces where practical.

**Marking scheme pattern:** Upload via multipart `POST /api/materials` (field `markingSchemeFile`) or post-upload via `POST /api/materials/[id]/marking-scheme`. Both store file at `uploads/.../ms-{ts}-{name}` and persist three nullable fields on `Material`. Delete cascade handled in `DELETE /api/materials/[id]`.

**MCQ set ↔ material link:** `mcqSet.materialId` is an optional FK. When set, the set appears in the MCQ panel's set switcher for that material. Admin links a set to a material via the "Link PDF" dropdown in the MCQ Sets tab.

**CSV import:** Client parses CSV (handles quoted fields, detects 4/5-option from `optionCount`), validates answer in A–E, sends `POST /api/mcq/sets/[id]/questions/import` with body `{questions:[...]}`. Route calls `prisma.mCQQuestion.createMany` and increments `questionCount`.

**Set<string> spread (TypeScript):** Use `Array.from(set)` not `[...set]` — tsconfig target may be below ES2015 and spread on Set fails at compile time.

---

## Environment

`.env.local` is the only env file (not `.env`). Prisma CLI does **not** read `.env.local` automatically — pass `DATABASE_URL` explicitly when running Prisma commands outside `npm run build`.

Required variables:
```
AUTH_SECRET=<32-byte base64 string>
DATABASE_URL=file:./dev.db
GROQ_API_KEY=gsk_...          # from console.groq.com/keys — powers AI features
```

### AI / Groq
`lib/groq.ts` exports `groq` (Groq client) and `GROQ_MODEL = 'llama-3.3-70b-versatile'`. All AI API routes import from here. AI routes live under `app/api/ai/`. Install: `npm install groq-sdk`.
