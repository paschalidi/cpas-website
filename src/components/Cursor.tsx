import { useEffect, useRef, useState } from 'react';

export function Cursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorDotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const cursorDot = cursorDotRef.current;
    if (!cursor || !cursorDot) return;

    const onMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      cursor.style.transform = `translate(${clientX - cursor.offsetWidth / 2}px, ${clientY - cursor.offsetHeight / 2}px)`;
      cursorDot.style.transform = `translate(${clientX - cursorDot.offsetWidth / 2}px, ${clientY - cursorDot.offsetHeight / 2}px)`;
    };

    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  return (
    <>
      <div ref={cursorRef} className="cursor-follower fixed pointer-events-none z-50 w-16 h-16 border border-white/30 rounded-full transition-transform duration-200 ease-out" />
      <div ref={cursorDotRef} className="cursor-dot fixed pointer-events-none z-50 w-2 h-2 bg-white rounded-full transition-transform duration-100 ease-out" />
    </>
  );
}