import React, { useState, useEffect, useCallback, useMemo } from "react";
import DDIAThemeProvider from "../blog/components/ddia/DDIAThemeProvider";
import { flashcards as detailedCards, SECTIONS } from "./flashcardData/detailedCards";
import { flashcards as mainIdeasCards, CHAPTERS as MAIN_CHAPTERS } from "./flashcardData/mainIdeasCards";
import { flashcards as deeperCards, CHAPTERS as DEEP_CHAPTERS } from "./flashcardData/deeperCards";

type Tab = "detailed" | "main-ideas" | "deeper";

/* ─── Utilities ─── */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function InterviewPage() {
  const [activeTab, setActiveTab] = useState<Tab>("detailed");
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set(SECTIONS.map(s => s.id)));
  const [selectedChaptersMain, setSelectedChaptersMain] = useState<Set<number>>(new Set(MAIN_CHAPTERS.map(c => c.id)));
  const [selectedChaptersDeep, setSelectedChaptersDeep] = useState<Set<number>>(new Set(DEEP_CHAPTERS.map(c => c.id)));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [progress, setProgress] = useState<Record<string, "correct" | "wrong" | undefined>>({});

  /* Reset state when tab changes */
  useEffect(() => {
    setIndex(0);
    setFlipped(false);
    setShuffled(false);
    setProgress({});
  }, [activeTab]);

  /* Active deck, filters, and metadata */
  const { deck, card, total, metadata, selected, toggleFilter } = useMemo(() => {
    switch (activeTab) {
      case "detailed": {
        const filtered = detailedCards.filter(c => selectedSections.has(c.sectionShort));
        const d = shuffled ? shuffleArray(filtered) : filtered;
        return {
          deck: d,
          card: d[index],
          total: d.length,
          metadata: SECTIONS,
          selected: selectedSections,
          toggleFilter: (id: string | number) => {
            setSelectedSections(prev => {
              const next = new Set(prev);
              if (next.has(id as string)) {
                if (next.size > 1) next.delete(id as string);
              } else {
                next.add(id as string);
              }
              setIndex(0);
              setFlipped(false);
              return next;
            });
          },
        };
      }
      case "main-ideas": {
        const filtered = mainIdeasCards.filter(c => selectedChaptersMain.has(c.chapter));
        const d = shuffled ? shuffleArray(filtered) : filtered;
        return {
          deck: d,
          card: d[index],
          total: d.length,
          metadata: MAIN_CHAPTERS,
          selected: selectedChaptersMain,
          toggleFilter: (id: string | number) => {
            setSelectedChaptersMain(prev => {
              const next = new Set(prev);
              if (next.has(id as number)) {
                if (next.size > 1) next.delete(id as number);
              } else {
                next.add(id as number);
              }
              setIndex(0);
              setFlipped(false);
              return next;
            });
          },
        };
      }
      case "deeper": {
        const filtered = deeperCards.filter(c => selectedChaptersDeep.has(c.chapter));
        const d = shuffled ? shuffleArray(filtered) : filtered;
        return {
          deck: d,
          card: d[index],
          total: d.length,
          metadata: DEEP_CHAPTERS,
          selected: selectedChaptersDeep,
          toggleFilter: (id: string | number) => {
            setSelectedChaptersDeep(prev => {
              const next = new Set(prev);
              if (next.has(id as number)) {
                if (next.size > 1) next.delete(id as number);
              } else {
                next.add(id as number);
              }
              setIndex(0);
              setFlipped(false);
              return next;
            });
          },
        };
      }
    }
  }, [activeTab, index, selectedSections, selectedChaptersMain, selectedChaptersDeep, shuffled]);

  const goTo = useCallback((i: number) => {
    setIndex(Math.max(0, Math.min(total - 1, i)));
    setFlipped(false);
  }, [total]);

  const toggleShuffle = useCallback(() => {
    setShuffled(prev => !prev);
    setIndex(0);
    setFlipped(false);
  }, []);

  const mark = useCallback((id: number, grade: "correct" | "wrong") => {
    setProgress(prev => ({ ...prev, [id]: prev[id] === grade ? undefined : grade }));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goTo(index - 1);
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") goTo(index + 1);
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped(f => !f); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, goTo]);

  /* Stats */
  const correctCount = Object.values(progress).filter(v => v === "correct").length;
  const wrongCount = Object.values(progress).filter(v => v === "wrong").length;
  const gradedCount = correctCount + wrongCount;

  /* Tab config */
  const tabs: { id: Tab; label: string }[] = [
    { id: "detailed", label: `Detailed (${detailedCards.length})` },
    { id: "main-ideas", label: `Main Ideas (${mainIdeasCards.length})` },
    { id: "deeper", label: `Deeper (${deeperCards.length})` },
  ];

  /* Card header text based on tab */
  const cardHeader = useMemo(() => {
    if (!card) return "";
    switch (activeTab) {
      case "detailed":
        return card.section;
      case "main-ideas":
        return `Ch. ${(card as typeof mainIdeasCards[0]).chapter} — ${card.section}`;
      case "deeper":
        return card.section;
    }
  }, [card, activeTab]);

  if (!card) {
    return (
      <DDIAThemeProvider>
        <div className="min-h-screen flex flex-col items-center px-4 pt-24 md:pt-32 pb-12 md:pb-16">
          {/* Tab bar */}
          <div className="w-full max-w-4xl mb-8">
            <div className="flex flex-wrap gap-2 mb-6">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                    activeTab === tab.id
                      ? "bg-[#0c1a10] border-[#2a4651] text-[#f2fafc]"
                      : "bg-transparent border-[#1c2f37] text-[#8aa6b0] hover:border-[#2a4651] hover:text-[#f2fafc]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center text-[#f2fafc] flex-1">
            <p className="text-lg">Select at least one filter to begin.</p>
          </div>
        </div>
      </DDIAThemeProvider>
    );
  }

  return (
    <DDIAThemeProvider>
      <div className="min-h-screen flex flex-col items-center px-4 pt-24 md:pt-32 pb-12 md:pb-16">
        {/* ═══════ Header ═══════ */}
        <div className="w-full max-w-4xl mb-8">
          {/* Tab bar */}
          <div className="flex flex-wrap gap-2 mb-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                  activeTab === tab.id
                    ? "bg-[#0c1a10] border-[#2a4651] text-[#f2fafc]"
                    : "bg-transparent border-[#1c2f37] text-[#8aa6b0] hover:border-[#2a4651] hover:text-[#f2fafc]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#f2fafc] bg-gradient-to-r from-[#f2fafc] to-[#f2fafc]/60 bg-clip-text text-transparent">
                {activeTab === "detailed" && "DDIA Interview Deck"}
                {activeTab === "main-ideas" && "DDIA 2e — Main Ideas"}
                {activeTab === "deeper" && "DDIA 2e — Deeper"}
              </h1>
              <p className="text-sm text-[#8aa6b0] mt-2 font-mono">
                {total} cards active &middot; {gradedCount} graded
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleShuffle}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                  shuffled
                    ? "bg-[#f3c6ad]/10 border-[#f3c6ad] text-[#f3c6ad]"
                    : "bg-transparent border-[#1c2f37] text-[#8aa6b0] hover:border-[#2a4651] hover:text-[#f2fafc]"
                }`}
              >
                {shuffled ? "Unshuffle" : "Shuffle"}
              </button>
              <div className="flex items-center gap-2 text-sm font-mono text-[#8aa6b0]">
                <span className="text-[#34d399]">{correctCount}</span>
                <span>/</span>
                <span className="text-[#f87171]">{wrongCount}</span>
                <span>/</span>
                <span>{total - gradedCount}</span>
              </div>
            </div>
          </div>

          {/* ═══════ Filters ═══════ */}
          <div className="flex flex-wrap gap-2 mb-2">
            {metadata.map((item: any) => {
              const active = selected.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleFilter(item.id)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                    active
                      ? "bg-[#0c1a10] border-[#2a4651] text-[#f2fafc]"
                      : "bg-transparent border-[#1c2f37] text-[#8aa6b0] hover:border-[#2a4651]"
                  }`}
                >
                  <span className="font-mono text-xs mr-1.5 opacity-60">
                    {activeTab === "detailed" ? item.id : item.label}
                  </span>
                  {activeTab === "detailed" ? item.label : activeTab === "main-ideas" ? item.id : item.full}
                  <span className="font-mono text-xs ml-1.5 opacity-60">{item.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════ Progress Bar ═══════ */}
        <div className="w-full max-w-4xl mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 h-1.5 bg-[#1c2f37] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#f3c6ad] rounded-full transition-all duration-300"
                style={{ width: `${((index + 1) / total) * 100}%` }}
              />
            </div>
            <span className="text-sm font-mono text-[#8aa6b0] min-w-[3rem] text-right">
              {index + 1}/{total}
            </span>
          </div>
        </div>

        {/* ═══════ Card ═══════ */}
        <div className="w-full max-w-4xl mb-8">
          <div
            className="cursor-pointer"
            onClick={() => setFlipped(f => !f)}
            style={{ perspective: "1200px" }}
          >
            <div
              className="relative transition-transform duration-500 ease-out"
              style={{
                transformStyle: "preserve-3d",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                minHeight: "400px",
              }}
            >
              {/* Front — Question */}
              <div
                className="absolute inset-0 bg-[#0a0f0c] border border-[#1c2f37] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_-12px_rgba(0,0,0,0.55)] p-8 md:p-10 flex flex-col"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-mono text-[#8aa6b0] bg-[#0c1a10] px-3 py-1 rounded-md border border-[#1c2f37]">
                    Q{card.id}
                  </span>
                  <span className="text-xs font-mono text-[#8aa6b0] uppercase tracking-[0.12em]">
                    {cardHeader}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xl md:text-2xl leading-relaxed text-[#f2fafc] font-medium text-center max-w-3xl">
                    {card.question}
                  </p>
                </div>
                <div className="text-center text-sm text-[#8aa6b0] mt-6 font-mono">
                  Click or press Space to reveal
                </div>
              </div>

              {/* Back — Answer */}
              <div
                className="absolute inset-0 bg-[#0c1a10] border border-[#2a4651] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_-12px_rgba(0,0,0,0.55)] p-8 md:p-10 flex flex-col"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-mono text-[#f3c6ad] bg-[#2a4651] px-3 py-1 rounded-md border border-[#2a4651]">
                    A{card.id}
                  </span>
                  <span className="text-xs font-mono text-[#8aa6b0] uppercase tracking-[0.12em]">
                    {cardHeader}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-lg md:text-xl leading-relaxed text-[#f2fafc] text-center max-w-3xl">
                    {card.answer}
                  </p>
                </div>
                <div className="text-center text-sm text-[#8aa6b0] mt-6 font-mono">
                  Click or press Space to flip back
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ Controls ═══════ */}
        <div className="w-full max-w-4xl">
          {/* Self-grading */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <button
              onClick={(e) => { e.stopPropagation(); mark(card.id, "correct"); }}
              className={`px-5 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                progress[card.id] === "correct"
                  ? "bg-[#34d399]/10 border-[#34d399] text-[#34d399]"
                  : "bg-transparent border-[#1c2f37] text-[#8aa6b0] hover:border-[#2a4651] hover:text-[#f2fafc]"
              }`}
            >
              ✓ Got it
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); mark(card.id, "wrong"); }}
              className={`px-5 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                progress[card.id] === "wrong"
                  ? "bg-[#f87171]/10 border-[#f87171] text-[#f87171]"
                  : "bg-transparent border-[#1c2f37] text-[#8aa6b0] hover:border-[#2a4651] hover:text-[#f2fafc]"
              }`}
            >
              ✗ Missed
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="px-5 py-2.5 text-sm font-medium rounded-lg border border-[#1c2f37] bg-[#0a0f0c] text-[#f2fafc] hover:bg-[#1c2f37] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>

            <button
              onClick={() => goTo(index + 1)}
              disabled={index === total - 1}
              className="px-5 py-2.5 text-sm font-medium rounded-lg border border-[#1c2f37] bg-[#0a0f0c] text-[#f2fafc] hover:bg-[#1c2f37] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>

          {/* Keyboard hints */}
          <div className="mt-8 text-center text-xs text-[#8aa6b0] font-mono space-x-4">
            <span>← → navigate</span>
            <span>Space flip</span>
            <span>1-9 grade</span>
          </div>
        </div>
      </div>
    </DDIAThemeProvider>
  );
}
