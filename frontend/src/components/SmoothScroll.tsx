import { useEffect, ReactNode } from 'react';
import Lenis from '@studio-freight/lenis';

interface SmoothScrollProps {
  children: ReactNode;
}

/**
 * SmoothScroll component integrates Lenis for global smooth scrolling.
 * It ensures a premium, fluid scrolling experience across all pages.
 */
const SmoothScroll = ({ children }: SmoothScrollProps) => {
  useEffect(() => {
    // Initialize Lenis
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      infinite: false,
    });

    // RAF for Lenis
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    // Specific fix for any fixed elements or specific scroll containers if needed
    // lenis.on('scroll', ({ scroll, limit, velocity, direction, progress }) => {
    //   // Can add scroll-based animations here if needed
    // });

    return () => {
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
};

export default SmoothScroll;
