import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="max-w-sm text-center">
        <p className="text-sm font-semibold text-slate-400">404</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">Page not found</h1>
        <p className="mt-1 text-sm text-slate-500">It may have been deleted, or the link is wrong.</p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
