"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const linkClass =
  "rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-blue-600";

const activeClass = "bg-blue-50 text-blue-600";

export function AppNavbar() {
  const pathname = usePathname();
  if (pathname === "/review") return null;

  const isHome = pathname === "/";
  const isAccuracy = pathname === "/accuracy";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white px-6 shadow-sm">
      <nav className="flex h-16 w-full items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div
            className="h-8 w-8 shrink-0 rounded-lg bg-blue-600"
            aria-hidden
          />
          <span className="text-xl font-bold text-gray-900">MedExtract</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className={`${linkClass} ${isHome ? activeClass : ""}`}
          >
            New Request
          </Link>
          <Link
            href="/accuracy"
            className={`${linkClass} ${isAccuracy ? activeClass : ""}`}
          >
            Accuracy
          </Link>
        </div>
      </nav>
    </header>
  );
}
