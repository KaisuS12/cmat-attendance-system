"use client";

import { useRef, useSyncExternalStore } from "react";
import { THEME_KEY } from "@/components/ThemeScript";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const currentTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

const REVEAL_MS = 600;

// Light/dark switch. The new theme spreads from the button as a growing
// circle where the browser supports view transitions (Chrome, Edge, Safari
// 18+, Firefox 144+); elsewhere, or with reduced motion on, it changes at once.
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light");
  const animating = useRef(false);
  const next = theme === "dark" ? "light" : "dark";

  function apply() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode: the theme just lasts until the page reloads.
    }
  }

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    if (animating.current) return; // a second tap mid-animation would restart it
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !document.startViewTransition) {
      apply();
      return;
    }

    const box = e.currentTarget.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    animating.current = true;
    const transition = document.startViewTransition(apply);
    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: REVEAL_MS, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" }
        );
      })
      .catch(() => {}); // skipped (e.g. page hidden): the theme has still changed
    transition.finished.finally(() => {
      animating.current = false;
    });
  }

  const label = `Switch to ${next} mode`;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 sm:h-9 sm:w-9"
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
