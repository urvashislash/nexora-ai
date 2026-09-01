import { animate, stagger } from 'animejs';

/**
 * Animates a numerical counter smoothly from 0 (or start) to end value using anime.js.
 */
export function animateCounter(
  element: HTMLElement | null,
  endValue: number,
  options?: {
    duration?: number;
    decimals?: number;
    suffix?: string;
    prefix?: string;
  }
) {
  if (!element) return;

  const duration = options?.duration ?? 1000;
  const decimals = options?.decimals ?? 0;
  const suffix = options?.suffix ?? '';
  const prefix = options?.prefix ?? '';

  const obj = { val: 0 };

  animate(obj, {
    val: endValue,
    ease: 'outExpo',
    duration: duration,
    onUpdate: () => {
      if (element) {
        element.textContent = `${prefix}${decimals > 0 ? obj.val.toFixed(decimals) : Math.round(obj.val)}${suffix}`;
      }
    },
  });
}

/**
 * Staggers the entrance fade-in and slide-up of child elements.
 */
export function animateStaggerEntrance(
  selectorOrElements: any,
  options?: {
    translateY?: number;
    duration?: number;
    delay?: number;
    stagger?: number;
  }
) {
  const translateY = options?.translateY ?? 12;
  const duration = options?.duration ?? 600;
  const delay = options?.delay ?? 0;
  const staggerTime = options?.stagger ?? 50;

  try {
    animate(selectorOrElements, {
      opacity: [0, 1],
      translateY: [translateY, 0],
      ease: 'outCubic',
      duration: duration,
      delay: stagger(staggerTime, { start: delay }),
    });
  } catch {
    // Graceful fallback for non-DOM environments
  }
}

/**
 * Subtle bounce effect on action confirmation.
 */
export function animateSuccessBounce(element: HTMLElement | null) {
  if (!element) return;

  animate(element, {
    scale: [1, 1.08, 1],
    ease: 'inOutQuad',
    duration: 350,
  });
}

/**
 * Animates SVG path stroke dashoffset drawing.
 */
export function animateSvgDraw(pathElement: SVGPathElement | null, duration: number = 1200) {
  if (!pathElement) return;

  try {
    const pathLength = pathElement.getTotalLength();
    pathElement.style.strokeDasharray = `${pathLength}`;
    pathElement.style.strokeDashoffset = `${pathLength}`;

    animate(pathElement, {
      strokeDashoffset: [pathLength, 0],
      ease: 'inOutQuart',
      duration: duration,
    });
  } catch {
    // fallback
  }
}
