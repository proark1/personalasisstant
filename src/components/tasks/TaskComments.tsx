import { useState, type FormEvent } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useTaskComments } from '@/hooks/useTaskComments';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface TaskCommentsProps {
  taskId: string;
  className?: string;
}

// Threaded discussion attached to a task. Reads + writes against the
// task_comments table, RLS-scoped to the task's owner OR any workspace
// member (so a Telegram /comment lands here too via realtime).
export function TaskComments({ taskId, className }: TaskCommentsProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { comments, loading, error, post, remove } = useTaskComments(taskId);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || posting) return;
    setPosting(true);
    try {
      await post(draft);
      setDraft('');
    } catch (err) {
      console.error('post comment failed', err);
      toast.error(t('comments.toast.saveFailed'));
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await remove(id);
    } catch (err) {
      console.error('delete comment failed', err);
      toast.error(t('comments.toast.deleteFailed'));
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
        <MessageSquare className="w-4 h-4" />
        <span>Comments {comments.length > 0 ? `(${comments.length})` : ''}</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </div>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No comments yet — start the conversation.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => {
            const mine = c.author_id === user?.id;
            return (
              <li key={c.id} className="rounded-md border border-border bg-card px-3 py-2">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {mine
                      ? 'You'
                      : (c.authorName || (c.author_id ? c.author_id.slice(0, 8) : 'Removed user'))}
                  </span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  {c.source && c.source !== 'web' && (
                    <>
                      <span>·</span>
                      <span className="lowercase">{c.source.replace(/_/g, ' ')}</span>
                    </>
                  )}
                  {mine && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-auto"
                      title="Delete comment"
                      onClick={() => handleDelete(c.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="mt-3 flex items-end gap-2">
        <Textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment…"
          className="resize-none text-sm"
          onKeyDown={(e) => {
            // Cmd/Ctrl-Enter submits — matches the rest of the app.
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              if (draft.trim() && !posting) handleSubmit(e as unknown as FormEvent);
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!draft.trim() || posting}
          title="Post comment (⌘/Ctrl+Enter)"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
