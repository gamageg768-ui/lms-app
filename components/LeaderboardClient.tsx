'use client';

interface LeaderboardRow {
  rank: number;
  initials: string;
  isCurrentUser: boolean;
  pct: number;
  totalScore: number;
  totalQuestions: number;
  attempts: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardClient({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-5xl mb-4">🏆</div>
        <p className="font-semibold text-gray-600">No attempts yet</p>
        <p className="text-sm mt-1">Be the first to complete an MCQ set in this subject!</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr>
            <th className="px-6 py-3 text-left">Rank</th>
            <th className="px-6 py-3 text-left">Student</th>
            <th className="px-6 py-3 text-right">Score</th>
            <th className="px-6 py-3 text-right">Attempts</th>
            <th className="px-6 py-3 text-right">Avg %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(row => (
            <tr key={row.rank}
              className={`transition ${row.isCurrentUser ? 'bg-blue-50 font-semibold' : 'hover:bg-gray-50'}`}>
              <td className="px-6 py-3 text-center">
                {row.rank <= 3 ? (
                  <span className="text-lg">{MEDALS[row.rank - 1]}</span>
                ) : (
                  <span className="text-gray-400 font-mono">#{row.rank}</span>
                )}
              </td>
              <td className="px-6 py-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${row.isCurrentUser ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                    {row.initials}
                  </div>
                  <span className={row.isCurrentUser ? 'text-blue-700' : 'text-gray-700'}>
                    {row.isCurrentUser ? 'You' : row.initials}
                  </span>
                </div>
              </td>
              <td className="px-6 py-3 text-right text-gray-600 font-mono">
                {row.totalScore}/{row.totalQuestions}
              </td>
              <td className="px-6 py-3 text-right text-gray-500">{row.attempts}</td>
              <td className="px-6 py-3 text-right">
                <span className={`font-bold ${row.pct >= 80 ? 'text-green-600' : row.pct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                  {row.pct}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
