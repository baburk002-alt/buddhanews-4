import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Scroll-reveal for story cards without an animation library.
 *
 * Replaces the framer-motion `whileInView` effect (which pulled ~110 KB into the
 * first page load). Cards fade/slide in once, the first time they come within
 * 60px of the viewport. Readers who prefer reduced motion, and browsers without
 * IntersectionObserver, see the content immediately. The visual rules live in
 * `index.css` under `[data-reveal]`.
 */
export function useReveal<T extends HTMLElement = HTMLElement>(index = 0) {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"pending" | "shown">(() => {
    if (typeof window === "undefined") return "shown";
    if (!("IntersectionObserver" in window)) return "shown";
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "shown" : "pending";
  });

  useEffect(() => {
    if (state === "shown") return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setState("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [state]);

  const style = { "--reveal-delay": `${Math.min(index * 0.05, 0.3)}s` } as CSSProperties;
  return { ref, style, "data-reveal": state } as const;
}
