import { useEffect, useRef } from 'react';

interface BoxProps {
  className?: string;
  w: number;
  d: number;
  h: number;
}

/** A box standing on the ground at the origin of its parent: five faces, base at y = 0, growing upward. */
function Box({ className = '', w, d, h }: BoxProps) {
  const style = { '--w': `${w}px`, '--d': `${d}px`, '--h': `${h}px` } as React.CSSProperties;
  return (
    <div className={`b3 ${className}`} style={style} aria-hidden="true">
      <i className="b3__f b3__front" />
      <i className="b3__f b3__back" />
      <i className="b3__f b3__left" />
      <i className="b3__f b3__right" />
      <i className="b3__f b3__top" />
    </div>
  );
}

/**
 * The brand idea in three dimensions: a goalpost whose right post slides away from the line that
 * was pledged while the crossbar quietly stretches to follow it. Pure CSS 3D, no WebGL and no
 * dependency. The scene follows the pointer a little, pauses when it is off screen, and holds
 * still in the "moved" pose for visitors who prefer reduced motion.
 */
export function Goalpost3D() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (element === null) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    let frame = 0;
    const onMove = (event: PointerEvent): void => {
      if (reduce.matches) return;
      const box = element.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element.style.setProperty('--ry', `${-30 + x * 14}deg`);
        element.style.setProperty('--rx', `${-16 - y * 10}deg`);
      });
    };
    const onLeave = (): void => {
      cancelAnimationFrame(frame);
      element.style.removeProperty('--ry');
      element.style.removeProperty('--rx');
    };
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);

    let observer: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) => {
        element.dataset.paused = entry && !entry.isIntersecting ? 'true' : 'false';
      });
      observer.observe(element);
    }
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
      observer?.disconnect();
    };
  }, []);

  return (
    <figure className="gp3d" ref={root}>
      <div className="gp3d__view" role="img" aria-label="A three-dimensional goalpost. The right post slides away from the line that was pledged, and the crossbar stretches to follow it.">
        <div className="gp3d__scene">
          <div className="gp3d__pitch" aria-hidden="true" />
          <div className="gp3d__pledgedline" aria-hidden="true" />
          <div className="gp3d__at gp3d__at--left">
            <Box className="gp3d__post" w={12} d={12} h={176} />
          </div>
          <div className="gp3d__at gp3d__at--ghost">
            <Box className="gp3d__ghost" w={12} d={12} h={176} />
          </div>
          <div className="gp3d__at gp3d__at--right">
            <div className="gp3d__slide">
              <Box className="gp3d__post gp3d__post--moved" w={12} d={12} h={176} />
            </div>
          </div>
          <div className="gp3d__at gp3d__at--bar">
            <div className="gp3d__stretch">
              <Box className="gp3d__bar" w={240} d={10} h={10} />
            </div>
          </div>
        </div>
      </div>
      <figcaption className="gp3d__caption">
        <span className="gp3d__key gp3d__key--pledged">Pledged</span>
        <span className="gp3d__key gp3d__key--moved">Reported</span>
        <span className="muted">Drag across the scene to look around</span>
      </figcaption>
    </figure>
  );
}
