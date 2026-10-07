"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { inputClass } from "@/components/ui";

// Search-as-you-type: after a short pause, updates ?q= in the URL with a
// soft navigation, so the server-rendered list refreshes in place (no full
// page reload, no Search button). Back/refresh keep the search.
export function LiveSearch({ initialQuery, placeholder }: { initialQuery: string; placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(initialQuery.trim());

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function go(next: string) {
    const q = next.trim();
    if (q === last.current) return;
    last.current = q;
    const params = new URLSearchParams();
    if (q) params.set("q", q); // a new search starts back on page 1
    startTransition(() => {
      router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
    });
  }

  return (
    <form
      role="search"
      className="relative mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go(value);
      }}
    >
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (timer.current) clearTimeout(timer.current);
          const next = e.target.value;
          timer.current = setTimeout(() => go(next), 300);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={`${inputClass} pl-9 pr-10`}
      />
      {pending && (
        <span className="absolute inset-y-0 right-3 flex items-center" role="status" aria-label="Searching">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-700" />
        </span>
      )}
    </form>
  );
}
