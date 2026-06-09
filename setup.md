# EduPortal LMS — Setup Guide

## Overview

A full-stack Learning Management System built with:
- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** (light mode)
- **NextAuth.js v5** (credentials auth)
- **Prisma** + SQLite
- **PDF.js** (in-browser PDF rendering with email watermark)
- **PWA** (installable, offline-ready)

---

## Features

### Student
- Choose from 6 subjects: Pure Maths, Applied Maths, Physics, Chemistry, Zoology, Botany
- 5 sections per subject: Past Papers, Model Papers, Short Notes, Flash Cards, Theory
- **PDF Viewer** — all PDFs render in-browser with your email as a watermark
- **MCQ Practice Panel** — 25% screen right panel for Past Papers & Model Papers
- **Flash Cards** — flip animation with known/unknown tracking
- No PDF download unless admin grants permission

### Admin
- Full material management (upload/delete PDFs per subject/section)
- Create MCQ sets with questions (A/B/C/D), set correct answers and explanations
- Grant/revoke per-student download permissions via permission matrix
- Manage flash cards per subject
- View all students and permissions

### Security
- Screenshot prevention (right-click disabled, keyboard shortcuts blocked, blur on window focus loss)
- Print disabled via CSS
- PDF rendered on canvas (not native browser PDF viewer) — prevents easy extraction
- Email watermark burned into every PDF page canvas
- PDF files stored outside `/public` — served only through authenticated API routes
- Download only allowed if explicit admin permission exists

---

## Quick Start

### 1. Extract & Install

```bash
cd lms-app
npm install
```

### 2. Configure Environment

Copy `.env.local` and set your values:

```bash
cp .env.local .env.local
```

Edit `.env.local`:
```env
AUTH_SECRET=your-random-32-char-secret-here
DATABASE_URL="file:./dev.db"
```

Generate a secret:
```bash
openssl rand -base64 32
```

### 3. Set Up Database

```bash
npx prisma generate
npx prisma db push
```

### 4. Seed Admin User

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

This creates: **admin@lms.com** / **admin123**

> ⚠️ Change the admin password after first login via the DB or add a profile page.

### 5. Run Development Server

```bash
npm run dev
```

Open: http://localhost:3000

---

## Production Build

```bash
npm run build
npm start
```

---

## File Upload Storage

PDFs are stored in `/uploads/` at the project root (outside `/public` for security).

**For production**, replace local file storage with cloud storage (AWS S3, Cloudinary, etc.):
1. In `app/api/materials/route.ts` → upload to S3 instead of `writeFile`
2. In `app/api/materials/[id]/serve/route.ts` → stream from S3 instead of `readFile`

---

## Admin Workflow

1. Login as admin → `/admin`
2. Go to **Subject → Section** (e.g. Physics → Past Papers)
3. **Upload PDFs** via the Materials tab
4. **Create MCQ Sets** via the MCQ tab → add questions with A/B/C/D options
5. **Grant download permissions** via the Permissions tab (matrix of students × materials)
6. **Add Flash Cards** via Flash Cards tab under each subject

---

## Student Workflow

1. Register at `/register`
2. Login → redirected to `/dashboard`
3. Select subject → section → click a material
4. PDF opens in viewer with email watermark
5. MCQ panel appears on right for Papers sections
6. Answer questions → submit → see score and explanations

---

## Project Structure

```
lms-app/
├── app/
│   ├── (auth)/login & register
│   ├── (student)/dashboard, subject/[subject]/[section]
│   ├── (admin)/admin/** (full admin panel)
│   └── api/**  (REST API routes)
├── components/
│   ├── PDFViewer.tsx       ← Canvas PDF rendering + watermark
│   ├── MCQPanel.tsx        ← 25% panel, scrollable quiz
│   ├── FlashCardPage.tsx   ← Flip card UI
│   ├── MaterialViewerClient.tsx ← 75/25 split layout
│   ├── AdminSectionClient.tsx   ← Full admin section management
│   ├── AdminSidebar.tsx
│   ├── StudentNavbar.tsx
│   └── ScreenshotGuard.tsx ← JS/CSS screenshot prevention
├── lib/
│   ├── auth.ts             ← NextAuth config
│   ├── db.ts               ← Prisma singleton
│   └── utils.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── types/index.ts
├── middleware.ts            ← Route protection
└── uploads/                ← PDF storage (git-ignored)
```

---

## Customization

### Change Subjects
Edit `types/index.ts` → `SUBJECTS` array.

### Change Sections
Edit `types/index.ts` → `SECTIONS` array. Set `hasMCQ: true` to add MCQ panel.

### Styling
All UI uses Tailwind CSS light mode. Edit `app/globals.css` for global overrides.

### Add More Screenshot Protection
The `ScreenshotGuard` component in `components/ScreenshotGuard.tsx` handles all JS-based protection. Note: 100% screenshot prevention is impossible in web browsers — the watermark is the primary protection.

---

## Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@lms.com | admin123 |

Students self-register at `/register`.

---

## Tech Stack Versions

| Package | Version |
|---------|---------|
| next | 14.2.5 |
| next-auth | 5.0.0-beta.20 |
| prisma | 5.17.0 |
| pdfjs-dist | 4.4.168 |
| tailwindcss | 3.4.6 |
| typescript | 5.5.4 |
