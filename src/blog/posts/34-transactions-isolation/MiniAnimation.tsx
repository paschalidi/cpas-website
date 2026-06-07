import React, { useEffect, useRef } from 'react';

type Kind = 'atomic' | 'lock' | 'detect' | 'cas' | 'merge';

// Easing function used in the original
function easeInOutQuad(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

function animateAttr(
  el: SVGElement | null,
  attr: string,
  from: number,
  to: number,
  dur: number,
  delay: number,
  done?: () => void
) {
  setTimeout(() => {
    if (!el) { if (done) done(); return; }
    const $el: SVGElement = el;
    const start = performance.now();
    function frame(now: number) {
      const p = Math.min((now - start) / dur, 1);
      const eased = easeInOutQuad(p);
      $el.setAttribute(attr, String(from + (to - from) * eased));
      if (p < 1) {
        requestAnimationFrame(frame);
      } else if (done) {
        done();
      }
    }
    requestAnimationFrame(frame);
  }, delay);
}

const MiniAtomic = () => {
  const valRef = useRef<SVGTextElement>(null);
  const c1Ref = useRef<SVGCircleElement>(null);
  const c2Ref = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const val = valRef.current;
    const c1 = c1Ref.current;
    const c2 = c2Ref.current;
    if (!val || !c1 || !c2) return;
    const $val: SVGTextElement = val;
    const $c1: SVGCircleElement = c1;
    const $c2: SVGCircleElement = c2;

    let v = 10;
    let running = true;

    function loop() {
      if (!running) return;
      v = 10;
      $val.textContent = '10';
      $c1.setAttribute('cx', '30');
      $c1.setAttribute('opacity', '1');
      $c2.setAttribute('cx', '30');
      $c2.setAttribute('opacity', '1');

      animateAttr($c1, 'cx', 30, 120, 500, 0, () => {
        if (!running) return;
        v++;
        $val.textContent = String(v);
        $c1.setAttribute('opacity', '0');
        animateAttr($c2, 'cx', 30, 120, 500, 200, () => {
          if (!running) return;
          v++;
          $val.textContent = String(v);
          $c2.setAttribute('opacity', '0');
          setTimeout(loop, 900);
        });
      });
    }
    loop();
    return () => { running = false; };
  }, []);

  return (
    <svg viewBox="0 0 300 60" width="100%" height="60">
      <rect x={120} y={18} width={60} height={24} rx={6} fill="#1e1e1b" stroke="#b9791f" />
      <text ref={valRef} x={150} y={34} fill="#ece4d3" fontSize={12} textAnchor="middle" fontFamily="JetBrains Mono, monospace">10</text>
      <circle ref={c1Ref} cx={30} cy={30} r={7} fill="rgba(232,163,61,.3)" stroke="#e8a33d" />
      <circle ref={c2Ref} cx={30} cy={30} r={7} fill="rgba(201,165,142,.3)" stroke="#c9a58e" />
      <text x={150} y={55} fill="#7c766a" fontSize={8} textAnchor="middle" fontFamily="JetBrains Mono, monospace">serialized at the row</text>
    </svg>
  );
};

const MiniLock = () => {
  const boxRef = useRef<SVGRectElement>(null);
  const lockRef = useRef<SVGTextElement>(null);
  const waitRef = useRef<SVGTextElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const lock = lockRef.current;
    const wait = waitRef.current;
    if (!box || !lock || !wait) return;
    const $box: SVGRectElement = box;
    const $lock: SVGTextElement = lock;
    const $wait: SVGTextElement = wait;

    let running = true;

    function loop() {
      if (!running) return;
      $box.setAttribute('stroke', '#b9791f');
      $lock.textContent = '\uD83D\uDD12';
      $wait.textContent = 'wait';
      $wait.setAttribute('opacity', '1');
      setTimeout(() => {
        if (!running) return;
        $box.setAttribute('stroke', '#1f8d6e');
        $lock.textContent = '\u2713';
        $wait.setAttribute('opacity', '0');
      }, 1400);
      setTimeout(() => {
        if (running) loop();
      }, 2600);
    }
    loop();
    return () => { running = false; };
  }, []);

  return (
    <svg viewBox="0 0 300 60" width="100%" height="60">
      <rect ref={boxRef} x={120} y={16} width={60} height={28} rx={6} fill="#1e1e1b" stroke="#322f29" />
      <text ref={lockRef} x={150} y={35} fill="#e8a33d" fontSize={16} textAnchor="middle" fontFamily="JetBrains Mono, monospace">\uD83D\uDD12</text>
      <text x={40} y={34} fill="#e8a33d" fontSize={12} textAnchor="middle" fontFamily="JetBrains Mono, monospace">A</text>
      <text x={260} y={34} fill="#c9a58e" fontSize={12} textAnchor="middle" fontFamily="JetBrains Mono, monospace">B</text>
      <text ref={waitRef} x={260} y={50} fill="#a78bd6" fontSize={8} textAnchor="middle" fontFamily="JetBrains Mono, monospace">wait</text>
      <line x1={215} y1={30} x2={185} y2={30} stroke="#a78bd6" strokeWidth={1.5} strokeDasharray="3 3" />
    </svg>
  );
};

const MiniDetect = () => {
  const valRef = useRef<SVGTextElement>(null);
  const boxRef = useRef<SVGRectElement>(null);
  const flagRef = useRef<SVGTextElement>(null);

  useEffect(() => {
    const val = valRef.current;
    const box = boxRef.current;
    const flag = flagRef.current;
    if (!val || !box || !flag) return;
    const $val: SVGTextElement = val;
    const $box: SVGRectElement = box;
    const $flag: SVGTextElement = flag;

    let running = true;

    function loop() {
      if (!running) return;
      $val.textContent = '10';
      $box.setAttribute('stroke', '#322f29');
      $flag.textContent = '';
      setTimeout(() => {
        if (!running) return;
        $val.textContent = '11';
        $box.setAttribute('stroke', '#e8a33d');
      }, 700);
      setTimeout(() => {
        if (!running) return;
        $flag.textContent = '\u2717 abort';
        $flag.setAttribute('font-size', '10');
        $box.setAttribute('stroke', '#b23b29');
      }, 1500);
      setTimeout(() => {
        if (!running) return;
        $flag.textContent = '\u21BA retry';
        $flag.setAttribute('fill', '#a78bd6');
      }, 2300);
      setTimeout(() => {
        if (!running) return;
        $val.textContent = '12';
        $box.setAttribute('stroke', '#1f8d6e');
        $flag.textContent = '\u2713';
        $flag.setAttribute('fill', '#4cc4a0');
        $flag.setAttribute('font-size', '14');
      }, 3100);
      setTimeout(() => {
        if (running) loop();
      }, 4300);
    }
    loop();
    return () => { running = false; };
  }, []);

  return (
    <svg viewBox="0 0 300 60" width="100%" height="60">
      <rect ref={boxRef} x={120} y={18} width={60} height={24} rx={6} fill="#1e1e1b" stroke="#322f29" />
      <text ref={valRef} x={150} y={34} fill="#ece4d3" fontSize={12} textAnchor="middle" fontFamily="JetBrains Mono, monospace">10</text>
      <text ref={flagRef} x={255} y={34} fill="#e8654f" fontSize={14} textAnchor="middle" fontFamily="JetBrains Mono, monospace" />
    </svg>
  );
};

const MiniCAS = () => {
  const valRef = useRef<SVGTextElement>(null);
  const boxRef = useRef<SVGRectElement>(null);
  const resRef = useRef<SVGTextElement>(null);

  useEffect(() => {
    const val = valRef.current;
    const box = boxRef.current;
    const res = resRef.current;
    if (!val || !box || !res) return;
    const $val: SVGTextElement = val;
    const $box: SVGRectElement = box;
    const $res: SVGTextElement = res;

    let running = true;

    function loop() {
      if (!running) return;
      $val.textContent = 'v = 10';
      $box.setAttribute('stroke', '#6fa8e0');
      $res.textContent = '';
      setTimeout(() => {
        if (!running) return;
        $res.textContent = '\u2713 set';
        $res.setAttribute('fill', '#4cc4a0');
        $box.setAttribute('stroke', '#1f8d6e');
        $val.textContent = 'v = 11';
      }, 900);
      setTimeout(() => {
        if (!running) return;
        $res.textContent = '';
        $box.setAttribute('stroke', '#e8a33d');
      }, 2000);
      setTimeout(() => {
        if (!running) return;
        $res.textContent = '\u2717 no-op';
        $res.setAttribute('fill', '#e8654f');
        $box.setAttribute('stroke', '#b23b29');
      }, 2600);
      setTimeout(() => {
        if (running) loop();
      }, 3900);
    }
    loop();
    return () => { running = false; };
  }, []);

  return (
    <svg viewBox="0 0 300 60" width="100%" height="60">
      <rect ref={boxRef} x={110} y={16} width={80} height={28} rx={6} fill="#1e1e1b" stroke="#322f29" />
      <text ref={valRef} x={150} y={30} fill="#ece4d3" fontSize={11} textAnchor="middle" fontFamily="JetBrains Mono, monospace">v = 10</text>
      <text x={150} y={40} fill="#7c766a" fontSize={7.5} textAnchor="middle" fontFamily="JetBrains Mono, monospace">where v=10?</text>
      <text ref={resRef} x={255} y={34} fill="#4cc4a0" fontSize={11} textAnchor="middle" fontFamily="JetBrains Mono, monospace" />
    </svg>
  );
};

const MiniMerge = () => {
  const leftRef = useRef<SVGRectElement>(null);
  const rightRef = useRef<SVGRectElement>(null);
  const mergedRef = useRef<SVGRectElement>(null);
  const mtxtRef = useRef<SVGTextElement>(null);

  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    const merged = mergedRef.current;
    const mtxt = mtxtRef.current;
    if (!left || !right || !merged || !mtxt) return;
    const $left: SVGRectElement = left;
    const $right: SVGRectElement = right;
    const $merged: SVGRectElement = merged;
    const $mtxt: SVGTextElement = mtxt;

    let running = true;

    function loop() {
      if (!running) return;
      [$left, $right].forEach((e) => e.setAttribute('opacity', '1'));
      $merged.setAttribute('opacity', '0');
      $mtxt.setAttribute('opacity', '0');

      animateAttr($left, 'x', 20, 95, 600, 400, undefined);
      animateAttr($right, 'x', 230, 145, 600, 400, () => {
        if (!running) return;
        $left.setAttribute('opacity', '0');
        $right.setAttribute('opacity', '0');
        $merged.setAttribute('opacity', '1');
        $mtxt.setAttribute('opacity', '1');
        $left.setAttribute('x', '20');
        $right.setAttribute('x', '230');
        setTimeout(() => {
          if (running) loop();
        }, 1200);
      });
    }
    loop();
    return () => { running = false; };
  }, []);

  return (
    <svg viewBox="0 0 300 60" width="100%" height="60">
      <rect ref={leftRef} x={20} y={18} width={50} height={24} rx={6} fill="rgba(232,163,61,.18)" stroke="#e8a33d" />
      <rect ref={rightRef} x={230} y={18} width={50} height={24} rx={6} fill="rgba(201,165,142,.18)" stroke="#c9a58e" />
      <text x={45} y={34} fill="#e8a33d" fontSize={10} textAnchor="middle" fontFamily="JetBrains Mono, monospace">v=A</text>
      <text x={255} y={34} fill="#c9a58e" fontSize={10} textAnchor="middle" fontFamily="JetBrains Mono, monospace">v=B</text>
      <rect ref={mergedRef} x={120} y={18} width={60} height={24} rx={6} fill="rgba(76,196,160,.18)" stroke="#4cc4a0" opacity={0} />
      <text ref={mtxtRef} x={150} y={34} fill="#4cc4a0" fontSize={10} textAnchor="middle" fontFamily="JetBrains Mono, monospace" opacity={0}>merge</text>
    </svg>
  );
};

export default function MiniAnimation({ kind }: { kind: Kind }) {
  switch (kind) {
    case 'atomic': return <MiniAtomic />;
    case 'lock': return <MiniLock />;
    case 'detect': return <MiniDetect />;
    case 'cas': return <MiniCAS />;
    case 'merge': return <MiniMerge />;
    default: return null;
  }
}
