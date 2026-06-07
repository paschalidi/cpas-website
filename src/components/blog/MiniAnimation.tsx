'use client';

import React, { useEffect, useRef } from 'react';

type AnimationKind = 'publish' | 'route' | 'receive';

interface MiniAnimationProps {
  kind: AnimationKind;
}

/**
 * Three small SVG animations for the Act cards.
 * Each runs on a continuous loop using requestAnimationFrame.
 */
export function MiniAnimation({ kind }: MiniAnimationProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const ns = 'http://www.w3.org/2000/svg';
    const el = (tag: string, attrs: Record<string, string>) => {
      const e = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      return e as SVGElement;
    };

    const addTxt = (
      x: number,
      y: number,
      text: string,
      fill: string,
      size?: string,
      anchor?: string,
    ) => {
      const t = el('text', {
        x: String(x),
        y: String(y),
        fill,
        'font-family': "'JetBrains Mono', monospace",
        'font-size': size || '9',
        'text-anchor': anchor || 'middle',
      });
      t.textContent = text;
      svg.appendChild(t);
    };

    // Clear any previous run
    svg.innerHTML = '';

    if (kind === 'publish') {
      const req = el('rect', {
        x: '18',
        y: '30',
        width: '70',
        height: '30',
        rx: '6',
        fill: 'rgb(12,42,23)',
        stroke: 'rgb(33,52,37)',
      });
      svg.appendChild(req);
      addTxt(53, 49, 'request', 'rgb(248,247,244)', '9');

      const queue = el('rect', {
        x: '130',
        y: '30',
        width: '60',
        height: '30',
        rx: '6',
        fill: 'rgb(12,42,23)',
        stroke: 'rgb(243,198,173)',
      });
      svg.appendChild(queue);
      addTxt(160, 44, 'queue', 'rgb(243,198,173)', '8');
      addTxt(160, 55, 'task q', 'rgb(248,247,244/0.4)', '6');

      const broker = el('circle', {
        cx: '280',
        cy: '45',
        r: '18',
        fill: 'rgb(12,42,23)',
        stroke: 'rgb(243,198,173/0.6)',
      });
      svg.appendChild(broker);
      addTxt(280, 48, 'B', 'rgb(243,198,173)', '9');

      const dot = el('circle', {
        cx: '53',
        cy: '45',
        r: '5',
        fill: 'rgb(243,198,173)',
        opacity: '0',
      });
      svg.appendChild(dot);

      const check = el('text', {
        x: '53',
        y: '20',
        fill: 'rgb(243,198,173)',
        'font-family': "'JetBrains Mono', monospace",
        'font-size': '8',
        'text-anchor': 'middle',
        opacity: '0',
      });
      check.textContent = '✓ 200 OK';
      svg.appendChild(check);

      let frameId = 0;
      let start = 0;

      const tween = (
        node: SVGElement,
        attr: string,
        from: number,
        to: number,
        dur: number,
        delay: number,
        done?: () => void,
      ) => {
        const t0 = performance.now() + delay;
        const f = (now: number) => {
          if (now < t0) {
            frameId = requestAnimationFrame(f);
            return;
          }
          const p = Math.min((now - t0) / dur, 1);
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          node.setAttribute(attr, String(from + (to - from) * e));
          if (p < 1) {
            frameId = requestAnimationFrame(f);
          } else if (done) {
            done();
          }
        };
        frameId = requestAnimationFrame(f);
      };

      const loop = () => {
        dot.setAttribute('opacity', '1');
        dot.setAttribute('cx', '53');
        dot.setAttribute('cy', '45');
        check.setAttribute('opacity', '0');
        tween(dot, 'cx', 53, 160, 500, 200, () => {
          check.setAttribute('opacity', '1');
          tween(dot, 'cx', 160, 280, 650, 400, () => {
            dot.setAttribute('opacity', '0');
            frameId = window.setTimeout(loop, 700) as unknown as number;
          });
        });
      };

      loop();

      return () => {
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
      };
    }

    if (kind === 'route') {
      const ps = el('circle', {
        cx: '45',
        cy: '45',
        r: '17',
        fill: 'rgb(12,42,23)',
        stroke: 'rgb(243,198,173/0.6)',
      });
      svg.appendChild(ps);
      addTxt(45, 48, 'B', 'rgb(243,198,173)', '9');

      const ys = [20, 45, 70];
      const targets = ys.map((y) => {
        const r = el('rect', {
          x: '250',
          y: String(y - 11),
          width: '55',
          height: '22',
          rx: '5',
          fill: 'rgb(12,42,23)',
          stroke: 'rgb(33,52,37)',
        });
        svg.appendChild(r);
        return r;
      });
      addTxt(277, 24, '/events', 'rgb(248,247,244/0.4)', '7');
      addTxt(277, 49, '/events', 'rgb(248,247,244/0.4)', '7');
      addTxt(277, 74, '/events', 'rgb(248,247,244/0.4)', '7');
      addTxt(150, 12, 'events.yml', 'rgb(243,198,173)', '7.5');

      const dots: SVGElement[] = [];
      const frameIds: number[] = [];

      const tweenDot = (
        dot: SVGElement,
        fromX: number,
        toX: number,
        toY: number,
        dur: number,
        delay: number,
        target: SVGElement,
      ) => {
        const t0 = performance.now() + delay;
        const startX = fromX;
        const startY = toY;
        const f = (now: number) => {
          if (now < t0) {
            const id = requestAnimationFrame(f);
            frameIds.push(id);
            return;
          }
          const p = Math.min((now - t0) / dur, 1);
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          dot.setAttribute('cx', String(startX + (toX - startX) * e));
          dot.setAttribute('cy', String(startY));
          if (p < 1) {
            const id = requestAnimationFrame(f);
            frameIds.push(id);
          } else {
            target.setAttribute('stroke', 'rgb(243,198,173)');
            setTimeout(() => {
              target.setAttribute('stroke', 'rgb(33,52,37)');
              dot.remove();
            }, 400);
          }
        };
        const id = requestAnimationFrame(f);
        frameIds.push(id);
      };

      const loop = () => {
        ys.forEach((y, i) => {
          const d = el('circle', {
            cx: '45',
            cy: '45',
            r: '4',
            fill: 'rgb(243,198,173)',
            opacity: '0',
          });
          svg.appendChild(d);
          d.setAttribute('opacity', '1');
          tweenDot(d, 45, 250, y, 600, i * 180, targets[i]);
        });
        const tid = window.setTimeout(loop, 2200);
        frameIds.push(tid as unknown as number);
      };

      loop();

      return () => {
        frameIds.forEach((id) => {
          cancelAnimationFrame(id);
          clearTimeout(id);
        });
      };
    }

    if (kind === 'receive') {
      addTxt(40, 20, 'event', 'rgb(243,198,173)', '8');

      const dot = el('circle', {
        cx: '20',
        cy: '50',
        r: '5',
        fill: 'rgb(243,198,173)',
      });
      svg.appendChild(dot);

      const gate = el('rect', {
        x: '120',
        y: '32',
        width: '50',
        height: '36',
        rx: '6',
        fill: 'rgb(12,42,23)',
        stroke: 'rgb(243,198,173)',
      });
      svg.appendChild(gate);
      addTxt(145, 49, 'JWT', 'rgb(243,198,173)', '8');
      addTxt(145, 60, 'verify', 'rgb(248,247,244/0.4)', '6.5');

      const handler = el('rect', {
        x: '240',
        y: '32',
        width: '60',
        height: '36',
        rx: '6',
        fill: 'rgb(12,42,23)',
        stroke: 'rgb(33,52,37)',
      });
      svg.appendChild(handler);
      addTxt(270, 49, 'domain', 'rgb(248,247,244)', '8');
      addTxt(270, 60, 'handler', 'rgb(248,247,244/0.4)', '6.5');

      const stamp = el('text', {
        x: '145',
        y: '26',
        fill: 'rgb(243,198,173)',
        'font-family': "'JetBrains Mono', monospace",
        'font-size': '12',
        'text-anchor': 'middle',
        opacity: '0',
      });
      stamp.textContent = '✓';
      svg.appendChild(stamp);

      let frameId = 0;

      const tween = (
        node: SVGElement,
        attr: string,
        from: number,
        to: number,
        dur: number,
        delay: number,
        done?: () => void,
      ) => {
        const t0 = performance.now() + delay;
        const f = (now: number) => {
          if (now < t0) {
            frameId = requestAnimationFrame(f);
            return;
          }
          const p = Math.min((now - t0) / dur, 1);
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          node.setAttribute(attr, String(from + (to - from) * e));
          if (p < 1) {
            frameId = requestAnimationFrame(f);
          } else if (done) {
            done();
          }
        };
        frameId = requestAnimationFrame(f);
      };

      const loop = () => {
        dot.setAttribute('cx', '20');
        dot.setAttribute('opacity', '1');
        stamp.setAttribute('opacity', '0');
        gate.setAttribute('stroke', 'rgb(243,198,173)');
        handler.setAttribute('stroke', 'rgb(33,52,37)');
        tween(dot, 'cx', 20, 145, 550, 200, () => {
          stamp.setAttribute('opacity', '1');
          gate.setAttribute('stroke', 'rgb(243,198,173/0.5)');
          setTimeout(() => {
            tween(dot, 'cx', 145, 270, 550, 150, () => {
              handler.setAttribute('stroke', 'rgb(243,198,173/0.5)');
              dot.setAttribute('opacity', '0');
              setTimeout(loop, 900);
            });
          }, 400);
        });
      };

      loop();

      return () => {
        cancelAnimationFrame(frameId);
      };
    }
  }, [kind]);

  return (
    <div className="mt-4 h-[90px] rounded-lg border border-blog-border/10 bg-[rgb(2,10,5)] overflow-hidden">
      <svg
        ref={svgRef}
        viewBox="0 0 320 90"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      />
    </div>
  );
}
