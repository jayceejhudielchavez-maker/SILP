// Small JavaScript animation helpers for the dashboard.
// Everything is skipped (shown in its final state) when the computer asks for reduced motion.
export class Motion {
  static get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Fast start, soft landing
  static ease(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // Calls step(progress 0 → 1) every frame for `ms` milliseconds
  static tween(ms, step, delay = 0) {
    if (Motion.reduced) { step(1); return Promise.resolve(); }
    return new Promise(resolve => {
      setTimeout(() => {
        let start = null;   // taken from the first frame, so progress never starts below 0
        const frame = now => {
          if (start === null) start = now;
          const p = Math.min(1, Math.max(0, (now - start) / ms));
          step(Motion.ease(p));
          if (p < 1) requestAnimationFrame(frame); else resolve();
        };
        requestAnimationFrame(frame);
      }, delay);
    });
  }

  // Number that counts up (or down) to its value
  static countUp(el, to, { from = 0, ms = 1200, delay = 0, format = n => n.toLocaleString() } = {}) {
    return Motion.tween(ms, k => { el.textContent = format(Math.round(from + (to - from) * k)); }, delay);
  }

  // Elements glide up into place one after another
  static reveal(elements, { stagger = 80, distance = 22, ms = 700 } = {}) {
    if (Motion.reduced) return;
    [...elements].forEach((el, i) => el.animate(
      [{ opacity: 0, transform: `translateY(${distance}px)` }, { opacity: 1, transform: 'none' }],
      { duration: ms, delay: i * stagger, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' }));
  }

  // Gentle up-and-down drift that never stops (the logo)
  static float(el, { distance = 6, ms = 4200 } = {}) {
    if (Motion.reduced) return;
    el.animate([{ transform: 'translateY(0)' }, { transform: `translateY(-${distance}px)` }],
      { duration: ms, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
  }

  // Follows the mouse slightly inside an area, for a sense of depth
  static parallax(area, el, strength = 10) {
    if (Motion.reduced) return;
    area.addEventListener('pointermove', e => {
      const r = area.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.translate = `${(x * strength).toFixed(1)}px ${(y * strength).toFixed(1)}px`;
    });
    area.addEventListener('pointerleave', () => { el.style.translate = '0 0'; });
  }
}
