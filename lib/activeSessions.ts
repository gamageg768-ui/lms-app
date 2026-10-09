// In-memory concurrent session tracker (single-server; fine for dev/small deployments)
interface SessionEntry {
  userId: string;
  materialId: string;
  sessionKey: string;
  lastSeen: number;
}

const sessions = new Map<string, SessionEntry>();
const SESSION_TTL = 60_000; // 60s — clients heartbeat every 30s

function prune() {
  const now = Date.now();
  Array.from(sessions.entries()).forEach(([k, v]) => {
    if (now - v.lastSeen > SESSION_TTL) sessions.delete(k);
  });
}

export function registerSession(userId: string, materialId: string, sessionKey: string): boolean {
  prune();
  const compositeKey = `${userId}:${materialId}`;
  const existing = sessions.get(compositeKey);
  const conflict = !!(existing && existing.sessionKey !== sessionKey && Date.now() - existing.lastSeen <= SESSION_TTL);
  sessions.set(compositeKey, { userId, materialId, sessionKey, lastSeen: Date.now() });
  return conflict;
}

export function heartbeat(userId: string, materialId: string, sessionKey: string): boolean {
  return registerSession(userId, materialId, sessionKey);
}
