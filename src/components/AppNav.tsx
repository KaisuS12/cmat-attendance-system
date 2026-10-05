"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  const allItems = [...items, { href: "/account/password", label: "Account" }];

  return (
    <nav className="mx-auto max-w-4xl overflow-x-auto px-4">
      <ul className="flex gap-1 whitespace-nowrap">
        {allItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`inline-block border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
