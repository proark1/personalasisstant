import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, 
  Pin, 
  PinOff, 
  Eye, 
  Edit3, 
  Link2, 
  Tag,
  Trash2,
  Save
} from 'lucide-react';
import { Note } from '@/hooks/useNotes';
import DOMPurify from 'dompurify';

interface NoteEditorProps {
  note: Note;
  onUpdate: (noteId: string, updates: Partial<Pick<Note, 'title' | 'content' | 'linkedItems' | 'tags' | 'isPinned'>>) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
  onBack: () => void;
}

export function NoteEditor({ note, onUpdate, onDelete, onBack }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isPreview, setIsPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setHasChanges(false);
  }, [note.id, note.title, note.content]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setHasChanges(true);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(true);
  };

  const handleSave = useCallback(async () => {
    if (!hasChanges) return;
    setSaving(true);
    await onUpdate(note.id, { title, content });
    setHasChanges(false);
    setSaving(false);
  }, [note.id, title, content, hasChanges, onUpdate]);

  const handleTogglePin = async () => {
    await onUpdate(note.id, { isPinned: !note.isPinned });
  };

  // Auto-save after 2 seconds of no changes
  useEffect(() => {
    if (!hasChanges) return;
    const timeout = setTimeout(() => {
      handleSave();
    }, 2000);
    return () => clearTimeout(timeout);
  }, [title, content, hasChanges, handleSave]);

  // Simple markdown preview
  const renderMarkdown = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-xl font-semibold mt-4 mb-2">{line.slice(3)}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-2xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
        }
        // Lists
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <li key={i} className="ml-4">{line.slice(2)}</li>;
        }
        // Checkboxes
        if (line.startsWith('- [ ] ')) {
          return <div key={i} className="flex items-center gap-2"><input type="checkbox" disabled /><span>{line.slice(6)}</span></div>;
        }
        if (line.startsWith('- [x] ')) {
          return <div key={i} className="flex items-center gap-2"><input type="checkbox" checked disabled /><span className="line-through">{line.slice(6)}</span></div>;
        }
        // Empty lines
        if (!line.trim()) {
          return <br key={i} />;
        }
        // Regular text with bold/italic — escape HTML first, then apply formatting, then sanitize.
        const escaped = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        const formatted = escaped
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`(.*?)`/g, '<code class="bg-muted px-1 rounded">$1</code>');
        const safe = DOMPurify.sanitize(formatted, {
          ALLOWED_TAGS: ['strong', 'em', 'code'],
          ALLOWED_ATTR: ['class'],
          ALLOW_DATA_ATTR: false,
        });
        return <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: safe }} />;
      });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        
        <Input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note title..."
          className="flex-1 border-none bg-transparent text-lg font-semibold focus-visible:ring-0"
        />

        <div className="flex items-center gap-1">
          {hasChanges && (
            <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setIsPreview(!isPreview)}
            title={isPreview ? 'Edit' : 'Preview'}
          >
            {isPreview ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleTogglePin}
            title={note.isPinned ? 'Unpin' : 'Pin'}
          >
            {note.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => onDelete(note.id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Linked Items & Tags */}
      {(note.linkedItems.length > 0 || note.tags.length > 0) && (
        <div className="px-4 py-2 border-b border-border flex flex-wrap gap-2">
          {note.linkedItems.map((item, i) => (
            <Badge key={i} variant="outline" className="gap-1">
              <Link2 className="w-3 h-3" />
              {item.title}
            </Badge>
          ))}
          {note.tags.map((tag, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              <Tag className="w-3 h-3" />
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {isPreview ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {content ? renderMarkdown(content) : (
                <p className="text-muted-foreground italic">No content yet. Start writing!</p>
              )}
            </div>
          ) : (
            <Textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Start writing... (Markdown supported)"
              className="min-h-[400px] border-none bg-transparent resize-none focus-visible:ring-0 font-mono text-sm"
            />
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
        Last updated: {note.updatedAt.toLocaleString()}
      </div>
    </div>
  );
}
