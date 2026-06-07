import React from 'react';
import { cn } from '../../lib/utils';

interface CodeBlockProps {
  language: 'python' | 'typescript' | 'yaml' | 'bash';
  children: string;
  className?: string;
}

/*
 * Custom tokeniser for code blocks. Covers Python and TypeScript syntax
 * used in this blog. Not a full parser — good enough to make code readable.
 */

type Token = { text: string; type: 'kw' | 'fn' | 'cls' | 'str' | 'num' | 'cm' | 'dec' | 'type' | 'plain' | 'punct' };

const colours: Record<Token['type'], string> = {
  kw:    'text-[#c792ea]',      // purple — keywords
  fn:    'text-[#82aaff]',      // blue — function names
  cls:   'text-[#ffcb6b]',      // yellow — class names
  str:   'text-[#c3e88d]',      // green — strings
  num:   'text-[#f78c6c]',      // orange — numbers
  cm:    'text-[#546e7a]',      // grey — comments
  dec:   'text-[#f07178]',      // pink — decorators
  type:  'text-[#ffcb6b]/80',   // muted yellow — types
  plain: 'text-blog-muted/70',  // default
  punct: 'text-blog-muted/30',  // brackets, commas, etc
};

const pyKeywords = new Set([
  'def', 'class', 'import', 'from', 'return', 'if', 'else', 'elif',
  'for', 'while', 'try', 'except', 'finally', 'raise', 'with', 'as',
  'pass', 'break', 'continue', 'and', 'or', 'not', 'in', 'is',
  'True', 'False', 'None', 'yield', 'async', 'await', 'lambda',
  'global', 'nonlocal', 'del', 'assert',
]);

const pyTypes = new Set([
  'str', 'int', 'float', 'bool', 'dict', 'list', 'tuple', 'set',
  'Any', 'None', 'Generic', 'TypeVar', 'Optional', 'Union',
  'Callable', 'Iterator', 'Iterable', 'Sequence', 'Mapping',
  'Self', 'type',
]);

const tsKeywords = new Set([
  'import', 'from', 'export', 'default', 'const', 'let', 'var',
  'function', 'return', 'if', 'else', 'for', 'while', 'try',
  'catch', 'throw', 'async', 'await', 'type', 'interface',
  'extends', 'implements', 'new', 'this', 'class', 'super',
  'switch', 'case', 'break', 'continue', 'typeof', 'keyof',
  'in', 'of', 'as', 'is', 'never', 'void', 'null', 'undefined',
  'true', 'false', 'enum', 'namespace', 'declare', 'readonly',
  'static', 'private', 'protected', 'public', 'abstract',
]);

const tsTypes = new Set([
  'string', 'number', 'boolean', 'any', 'void', 'never',
  'Record', 'Pick', 'Omit', 'Partial', 'Required',
  'Promise', 'Array', 'ReadonlyArray', 'Map', 'Set',
  'Exclude', 'Extract', 'NonNullable', 'ReturnType',
  'Parameters', 'ComponentType', 'ReactNode', 'FC',
  'Suspense', 'LazyExoticComponent',
]);

function tokenise(line: string, language: 'python' | 'typescript'): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  // Check if previous token was "class" or "def" so we can highlight the next word
  let prevKw = '';

  const push = (text: string, type: Token['type']) => {
    tokens.push({ text, type });
    if (['kw'].includes(type) && text !== '') prevKw = text;
  };

  while (i < line.length) {
    // Whitespace
    if (line[i] === ' ' || line[i] === '\t') {
      const m = line.slice(i).match(/^(\s+)/);
      if (m) { push(m[1], 'plain'); i += m[1].length; continue; }
    }

    // Comments
    if ((language === 'python' && line[i] === '#') ||
        (language === 'typescript' && line[i] === '/' && line[i + 1] === '/')) {
      push(line.slice(i), 'cm');
      break;
    }

    // Multi-line comment start (TS)
    if (language === 'typescript' && line[i] === '/' && line[i + 1] === '*') {
      const end = line.indexOf('*/', i + 2);
      push(line.slice(i, end !== -1 ? end + 2 : line.length), 'cm');
      break;
    }

    // Python decorator
    if (language === 'python' && line[i] === '@') {
      const m = line.slice(i).match(/^(@[\w.]+)/);
      if (m) { push(m[1], 'dec'); i += m[1].length; continue; }
    }

    // Python type annotations (after `:` but not `::`)
    if (line[i] === ':' && line[i + 1] !== ':') {
      push(':', 'punct');
      i++;
      continue;
    }

    // Python return type arrow
    if (line.slice(i).startsWith('->')) {
      push('->', 'punct');
      i += 2;
      continue;
    }

    // Strings (single quote)
    if (line[i] === "'") {
      const end = line.indexOf("'", i + 1);
      if (end !== -1) {
        // Check for triple single quotes
        if (line[i + 1] === "'" && line[i + 2] === "'") {
          const tEnd = line.indexOf("'''", i + 3);
          push(line.slice(i, tEnd !== -1 ? tEnd + 3 : line.length), 'str');
          i = tEnd !== -1 ? tEnd + 3 : line.length;
          continue;
        }
        push(line.slice(i, end + 1), 'str');
        i = end + 1;
        continue;
      }
    }

    // Strings (double quote)
    if (line[i] === '"') {
      const end = line.indexOf('"', i + 1);
      if (end !== -1) {
        // Check for triple double quotes
        if (line[i + 1] === '"' && line[i + 2] === '"') {
          const tEnd = line.indexOf('"""', i + 3);
          push(line.slice(i, tEnd !== -1 ? tEnd + 3 : line.length), 'str');
          i = tEnd !== -1 ? tEnd + 3 : line.length;
          continue;
        }
        // Handle escaped quotes
        let j = i + 1;
        while (j < line.length) {
          if (line[j] === '\\') { j += 2; continue; }
          if (line[j] === '"') { push(line.slice(i, j + 1), 'str'); i = j + 1; break; }
          j++;
        }
        if (j >= line.length) { push(line.slice(i), 'str'); i = line.length; }
        continue;
      }
    }

    // Template literal (TS)
    if (language === 'typescript' && line[i] === '`') {
      const end = line.indexOf('`', i + 1);
      if (end !== -1) {
        push(line.slice(i, end + 1), 'str');
        i = end + 1;
        continue;
      }
    }

    // Numbers
    if (line[i] >= '0' && line[i] <= '9') {
      const m = line.slice(i).match(/^(\d+\.?\d*)/);
      if (m) { push(m[1], 'num'); i += m[1].length; continue; }
    }

    // Words (keyword, type, function, class)
    if ((line[i] >= 'a' && line[i] <= 'z') || (line[i] >= 'A' && line[i] <= 'Z') || line[i] === '_') {
      const m = line.slice(i).match(/^([\w_]+)/);
      if (m) {
        const word = m[1];
        const keywords = language === 'python' ? pyKeywords : tsKeywords;
        const types = language === 'python' ? pyTypes : tsTypes;

        if (prevKw === 'class') {
          push(word, 'cls');
        } else if (prevKw === 'def') {
          push(word, 'fn');
        } else if (keywords.has(word)) {
          push(word, 'kw');
        } else if (types.has(word)) {
          push(word, 'type');
        } else if (word[0] >= 'A' && word[0] <= 'Z' && word.length > 1) {
          // Capitalized words are likely class names
          push(word, 'cls');
        } else {
          push(word, 'plain');
        }
        i += m[1].length;
        continue;
      }
    }

    // Punctuation & operators
    if ('{}[](),.:;=+\-*/%!<>|&^~?'.includes(line[i])) {
      push(line[i], 'punct');
      i++;
      continue;
    }

    // Fallback
    push(line[i], 'plain');
    i++;
  }

  return tokens;
}

export function CodeBlock({ language, children, className }: CodeBlockProps) {
  const raw = typeof children === 'string' ? children : String(children);
  const lines = raw.split('\n');

  return (
    <pre className={cn(className)}>
      <code>
        {lines.map((line, i) => {
          const tokens = tokenise(line, language);
          return (
            <span key={i} className="block">
              {tokens.map((t, j) => (
                <span key={j} className={colours[t.type]}>{t.text}</span>
              ))}
            </span>
          );
        })}
      </code>
    </pre>
  );
}
