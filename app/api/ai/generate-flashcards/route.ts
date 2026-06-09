import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { groq, GROQ_MODEL } from '@/lib/groq';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { text, subject, count = 10 } = await req.json();
  if (!text || !subject) return NextResponse.json({ error: 'text and subject required' }, { status: 400 });

  const safeCount = Math.min(Math.max(Number(count), 3), 20);

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.6,
    messages: [
      {
        role: 'system',
        content: 'You are a study assistant that creates concise, exam-focused flashcards. Always respond with valid JSON only — no markdown fences, no commentary, no extra text.',
      },
      {
        role: 'user',
        content: `Generate exactly ${safeCount} flashcards from the following ${subject} study text.

Return a JSON object with a "cards" array. Each card has:
- "question": a concise, testable question (not too long)
- "answer": a clear, direct answer — 1–3 sentences max

Study text:
${text.slice(0, 4000)}

Respond with JSON only:
{"cards":[{"question":"...","answer":"..."}]}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return NextResponse.json({ error: 'AI returned an unexpected format. Please try again.' }, { status: 500 });

  try {
    const parsed = JSON.parse(match[0]);
    return NextResponse.json({ cards: parsed.cards ?? [] });
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response. Please try again.' }, { status: 500 });
  }
}
