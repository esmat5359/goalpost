import { useRef, type ReactNode } from 'react';

/**
 * A card that leans toward the pointer and catches a little light. Decoration only: the content
 * inside stays ordinary, focusable markup, and nothing moves for visitors who prefer reduced motion.
 */
export function TiltCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const onMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const element = ref.current;
    if (element === null || reduce || event.pointerType === 'touch') return;
    const box = element.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    element.style.setProperty('--tx', `${((0.5 - y) * 7).toFixed(2)}deg`);
    element.style.setProperty('--ty', `${((x - 0.5) * 9).toFixed(2)}deg`);
    element.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
    element.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
  };
  const onLeave = (): void => {
    const element = ref.current;
    if (element === null) return;
    for (const name of ['--tx', '--ty', '--gx', '--gy']) element.style.removeProperty(name);
  };

  return (
    <div ref={ref} className={`tilt ${className}`} onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="tilt__inner">{children}</div>
    </div>
  );
}
