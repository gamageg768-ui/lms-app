'use client';
import { useState, useEffect } from 'react';

interface CommentUser { id: string; name: string; role: string; }
interface Comment {
  id: string; body: string; createdAt: string;
  user: CommentUser;
  replies: (Comment & { replies: never[] })[];
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function CommentItem({
  comment, materialId, currentUserId, currentUserRole, onDelete,
}: {
  comment: Comment; materialId: string; currentUserId: string; currentUserRole: string;
  onDelete: (id: string, parentId?: string) => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitReply = async () => {
    if (!replyBody.trim()) return;
    setSubmitting(true);
    await fetch(`/api/materials/${materialId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: replyBody, parentId: comment.id }),
    });
    setSubmitting(false);
    setReplyBody(''); setReplyOpen(false);
    // Parent will re-fetch
    window.dispatchEvent(new CustomEvent('lms-comment-added'));
  };

  const canDelete = currentUserId === comment.user.id || currentUserRole === 'ADMIN';

  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-white">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-semibold text-gray-800">{comment.user.name}</span>
            {comment.user.role === 'ADMIN' && (
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Admin</span>
            )}
            <span className="text-xs text-gray-400">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.body}</p>
          <div className="flex gap-2 mt-1.5">
            <button onClick={() => setReplyOpen(r => !r)}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium">↩ Reply</button>
            {canDelete && (
              <button onClick={() => onDelete(comment.id)}
                className="text-xs text-red-400 hover:text-red-600">Delete</button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="mt-2 ml-4 space-y-2 border-l-2 border-gray-100 pl-3">
          {comment.replies.map(r => (
            <div key={r.id} className="bg-gray-50 rounded-lg p-2">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-gray-700">{r.user.name}</span>
                {r.user.role === 'ADMIN' && <span className="text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded-full">Admin</span>}
                <span className="text-xs text-gray-400">{timeAgo(r.createdAt)}</span>
                {(currentUserId === r.user.id || currentUserRole === 'ADMIN') && (
                  <button onClick={() => onDelete(r.id, comment.id)}
                    className="text-xs text-red-400 hover:text-red-600 ml-auto">✕</button>
                )}
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {replyOpen && (
        <div className="mt-2 ml-4 flex gap-2">
          <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)}
            rows={2} placeholder="Write a reply..."
            className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
          <div className="flex flex-col gap-1">
            <button onClick={submitReply} disabled={submitting || !replyBody.trim()}
              className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition disabled:opacity-60">
              {submitting ? '...' : 'Reply'}
            </button>
            <button onClick={() => { setReplyOpen(false); setReplyBody(''); }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MaterialComments({ materialId }: { materialId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('STUDENT');

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/materials/${materialId}/comments`);
      if (res.ok) setComments(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => { setCurrentUserId(d.id ?? ''); setCurrentUserRole(d.role ?? 'STUDENT'); }).catch(() => {});
    fetchComments();
    window.addEventListener('lms-comment-added', fetchComments);
    return () => window.removeEventListener('lms-comment-added', fetchComments);
  }, [materialId]);

  const handleSubmit = async () => {
    if (!body.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/materials/${materialId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (res.ok) { setBody(''); await fetchComments(); }
    setSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    await fetch(`/api/materials/${materialId}/comments/${commentId}`, { method: 'DELETE' });
    await fetchComments();
  };

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-4 py-4">
      <h3 className="text-sm font-bold text-gray-700 mb-3">💬 Discussion ({comments.length})</h3>

      {/* New question input */}
      <div className="flex gap-2 mb-4">
        <textarea value={body} onChange={e => setBody(e.target.value)}
          rows={2} placeholder="Ask a question about this material..."
          className="flex-1 text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white" />
        <button onClick={handleSubmit} disabled={submitting || !body.trim()}
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition disabled:opacity-60 font-medium self-end">
          {submitting ? '...' : 'Post'}
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">Loading...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400">No questions yet. Be the first to ask!</p>
      ) : (
        <div className="space-y-3">
          {comments.map(c => (
            <CommentItem
              key={c.id} comment={c} materialId={materialId}
              currentUserId={currentUserId} currentUserRole={currentUserRole}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
