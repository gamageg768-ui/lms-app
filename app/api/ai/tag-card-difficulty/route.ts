import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { groq, GROQ_MODEL } from '@/lib/groq';

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (user?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { cards } = await req.json();
  if (!Array.isArray(cards) || cards.length === 0)
    return NextResponse.json({ error: 'cards array required' }, { status: 400 });

  const safeCards = cards.slice(0, 50).map((c: any) => ({ id: c.id, question: c.question, answer: c.answer }));

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content:
          'You are an educational difficulty assessor. Rate flashcard difficulty based on complexity of the concept, length of answer, and required prior knowledge. Always respond with valid JSON only — no markdown fences, no commentary.',
      },
      {
        role: 'user',
        content: `Rate the difficulty of each flashcard below. Use only: "easy", "medium", or "hard".

Criteria:
- easy: simple recall, single fact, short answer
- medium: requires understanding or multi-step recall
- hard: complex concept, multi-part answer, requires deep understanding

Cards:
${safeCards.map((c, i) => `${i + 1}. Q: ${c.question}\n   A: ${c.answer}`).join('\n\n')}

Respond with JSON only (same order as input):
{"ratings":[{"id":"<id>","difficulty":"easy|medium|hard"},...]}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return NextResponse.json({ error: 'AI returned unexpected format' }, { status: 500 });

  try {
    const parsed = JSON.parse(match[0]);
    // Merge IDs from safeCards since AI might not echo them correctly
    const ratings = (parsed.ratings ?? []).map((r: any, i: number) => ({
      id: safeCards[i]?.id ?? r.id,
      difficulty: ['easy', 'medium', 'hard'].includes(r.difficulty) ? r.difficulty : 'medium',
    }));
    return NextResponse.json({ ratings });
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
  }
}
