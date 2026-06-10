import React, { useState } from 'react';

export default function CodeBlock({
  title,
  lang,
  code,
}: {
  title?: string;
  lang?: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <figure className="group my-7 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg-code)] shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <span className="truncate font-mono text-[12px] text-[#9aa0ad]">
          {title ?? lang ?? 'snippet'}
        </span>
        <div className="flex items-center gap-3">
          {lang ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#62677a]">
              {lang}
            </span>
          ) : null}
          <button
            onClick={copy}
            className="rounded border border-white/15 px-2 py-0.5 font-mono text-[11px] text-[#9aa0ad] transition-colors hover:border-white/30 hover:text-[#e9e7e1]"
            aria-label="Copy code"
          >
            {copied ? 'copied' : 'copy'}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-[#e6e4dd]">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
