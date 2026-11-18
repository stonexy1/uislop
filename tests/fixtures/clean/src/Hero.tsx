import { ArrowRight, GitBranch } from "lucide-react";

export function Hero() {
  return (
    <section className="bg-zinc-50 px-6 py-20 dark:bg-zinc-950">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-zinc-600">
            <GitBranch className="size-4" aria-hidden />
            Release 4.2 adds rollback previews
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Ship on Fridays without the pager
          </h1>
          <p className="mt-4 max-w-prose text-zinc-600">
            Track deployments, review incidents, and keep your on-call rotation honest.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <a href="/signup" className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700">
              Start a free project
            </a>
            <a href="/docs" className="inline-flex items-center gap-1 text-zinc-900 underline">
              Read the deploy guide
              <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
        </div>
        <img
          src="/images/dashboard.png"
          alt="Deploy timeline showing three rollbacks"
          className="rounded-lg border border-zinc-200 shadow-sm"
        />
      </div>
    </section>
  );
}
