import React from 'react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Lightweight markdown renderer for chat messages.
 * Supports: **bold**, *italic*, `code`, [links](url), bullet/numbered lists, and citation links.
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listBuffer: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;
  let keyIdx = 0;

  const flushList = () => {
    if (!listBuffer) return;
    const Tag = listBuffer.type === 'ul' ? 'ul' : 'ol';
    const listClass = listBuffer.type === 'ul'
      ? 'list-disc list-inside space-y-0.5 my-1'
      : 'list-decimal list-inside space-y-0.5 my-1';
    elements.push(
      <Tag key={`list-${keyIdx++}`} className={listClass}>
        {listBuffer.items.map((item, i) => (
          <li key={i} className="text-sm leading-relaxed">{item}</li>
        ))}
      </Tag>
    );
    listBuffer = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Bullet list: - or • or *
    const bulletMatch = line.match(/^[\s]*[-•*]\s+(.*)/);
    if (bulletMatch) {
      if (!listBuffer || listBuffer.type !== 'ul') {
        flushList();
        listBuffer = { type: 'ul', items: [] };
      }
      listBuffer.items.push(renderInline(bulletMatch[1]));
      continue;
    }

    // Numbered list: 1. or 1)
    const numMatch = line.match(/^[\s]*(\d+)[.)]\s+(.*)/);
    if (numMatch) {
      if (!listBuffer || listBuffer.type !== 'ol') {
        flushList();
        listBuffer = { type: 'ol', items: [] };
      }
      listBuffer.items.push(renderInline(numMatch[2]));
      continue;
    }

    // Not a list item — flush any pending list
    flushList();

    // Heading: ### or ## or #
    const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const Tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
      const sizeClass = level === 1 ? 'text-base font-bold' : level === 2 ? 'text-sm font-semibold' : 'text-sm font-medium';
      elements.push(
        <Tag key={`h-${keyIdx++}`} className={cn(sizeClass, 'mt-2 mb-1')}>
          {renderInline(text)}
        </Tag>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={`br-${keyIdx++}`} className="h-1" />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${keyIdx++}`} className="text-sm leading-relaxed">
        {renderInline(line)}
      </p>
    );
  }

  flushList();

  return <div className={cn('space-y-0.5', className)}>{elements}</div>;
}

/** Render inline formatting: **bold**, *italic*, `code`, [link](url), citation [1] */
function renderInline(text: string): React.ReactNode {
  // Combined regex for all inline patterns
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[([^\]]+)\]\((https?:\/\/[^)]+)\))/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partKey = 0;

  while ((match = regex.exec(text)) !== null) {
    // Push text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // **bold**
      parts.push(<strong key={`b-${partKey++}`} className="font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      // *italic*
      parts.push(<em key={`i-${partKey++}`}>{match[4]}</em>);
    } else if (match[5]) {
      // `code`
      parts.push(
        <code key={`c-${partKey++}`} className="px-1 py-0.5 rounded bg-muted text-xs font-mono">
          {match[6]}
        </code>
      );
    } else if (match[7]) {
      // [text](url)
      parts.push(
        <a
          key={`a-${partKey++}`}
          href={match[9]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
        >
          {match[8]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
