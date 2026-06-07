import React from 'react';
import { cn } from '../../lib/utils';

interface YAMLBlockProps {
  children: string;
  className?: string;
}

/**
 * Simple YAML syntax highlighter.
 * Tokenises YAML-ish text and wraps each part in coloured spans.
 * Accepts children as a raw YAML string via the `code` prop.
 */
export function YAMLBlock({ children, className }: YAMLBlockProps) {
  const lines = children.split('\n');

  return (
    <pre
      className={cn(
        'mt-6 p-5 rounded-xl border border-blog-border/10 bg-[rgb(1,6,3)]',
        'font-mono text-xs leading-relaxed text-blog-muted/60 overflow-x-auto',
        'whitespace-pre',
        className,
      )}
    >
      <code>{lines.map((line, i) => renderLine(line, i))}</code>
    </pre>
  );
}

type Token = { text: string; type: 'key' | 'value' | 'string' | 'number' | 'punct' | 'plain' };

function tokenise(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // comment
    if (line[i] === '#' || (line[i] === ' ' && line.slice(i).match(/^ {2,}#/))) {
      tokens.push({ text: line.slice(i), type: 'punct' });
      break;
    }

    // key: or key :
    const keyMatch = line.slice(i).match(/^([\w-]+)(:)/);
    if (keyMatch && i === 0) {
      tokens.push({ text: keyMatch[1], type: 'key' });
      tokens.push({ text: ':', type: 'punct' });
      i += keyMatch[0].length;
      continue;
    }

    // quoted string
    const strMatch = line.slice(i).match(/^("[^"]*"|'[^']*')/);
    if (strMatch) {
      tokens.push({ text: strMatch[1], type: 'string' });
      i += strMatch[0].length;
      continue;
    }

    // number
    const numMatch = line.slice(i).match(/^\b(\d+)\b/);
    if (numMatch) {
      tokens.push({ text: numMatch[1], type: 'number' });
      i += numMatch[0].length;
      continue;
    }

    // list marker and brackets
    if (line[i] === '-' || line[i] === '[' || line[i] === ']' || line[i] === ',') {
      tokens.push({ text: line[i], type: 'punct' });
      i++;
      continue;
    }

    // bare value (alphanumeric, slash, dot)
    const valMatch = line.slice(i).match(/^([\w/.\-]+)/);
    if (valMatch) {
      tokens.push({ text: valMatch[1], type: 'value' });
      i += valMatch[0].length;
      continue;
    }

    // whitespace or other
    const wsMatch = line.slice(i).match(/^(\s+)/);
    if (wsMatch) {
      tokens.push({ text: wsMatch[1], type: 'plain' });
      i += wsMatch[0].length;
      continue;
    }

    tokens.push({ text: line[i], type: 'plain' });
    i++;
  }

  return tokens;
}

const tokenColors: Record<Token['type'], string> = {
  key: 'text-blog-accent',
  value: 'text-blog-text',
  string: 'text-blog-accent-muted',
  number: 'text-blog-muted/80',
  punct: 'text-blog-muted/30',
  plain: 'text-blog-muted/60',
};

function renderLine(line: string, index: number) {
  const tokens = tokenise(line);
  return (
    <span key={index} className="block">
      {tokens.map((t, j) => (
        <span key={j} className={tokenColors[t.type]}>
          {t.text}
        </span>
      ))}
    </span>
  );
}
